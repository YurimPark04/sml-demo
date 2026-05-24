"""Oracle Database connector and metadata helpers.

The module imports ``oracledb`` lazily so the rest of the demo can run even
when Oracle support has not been installed yet.
"""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
import os
import re
import time
from typing import Any, Iterator

import pandas as pd

from sml_dataset.connectors.base import DataConnector


_IDENTIFIER = re.compile(r"^[A-Za-z][A-Za-z0-9_$#]*$")
_THICK_MODE_INITIALIZED = False


@dataclass(frozen=True)
class OracleConnectionOptions:
    """Connection settings accepted by the Oracle connector."""

    host: str
    port: int = 1521
    service_name: str | None = None
    sid: str | None = None
    username: str | None = None
    user: str | None = None
    password: str | None = None
    password_env: str | None = None
    schema: str | None = None
    thick_mode: bool = False
    client_lib_dir: str | None = None

    @property
    def resolved_user(self) -> str:
        value = self.username or self.user
        if not value:
            raise ValueError("Oracle username is required.")
        return value

    @property
    def resolved_password(self) -> str:
        if self.password:
            return self.password
        if self.password_env:
            value = os.getenv(self.password_env)
            if value:
                return value
            raise ValueError(f"Environment variable {self.password_env!r} is not set.")
        raise ValueError("Oracle password or password_env is required.")


class OracleConnector(DataConnector):
    """Load a DataFrame from Oracle using a SQL query or table name."""

    def __init__(
        self,
        host: str,
        port: int = 1521,
        service_name: str | None = None,
        sid: str | None = None,
        username: str | None = None,
        user: str | None = None,
        password: str | None = None,
        password_env: str | None = None,
        schema: str | None = None,
        query: str | None = None,
        table: str | None = None,
        limit: int | None = None,
        thick_mode: bool = False,
        client_lib_dir: str | None = None,
    ) -> None:
        self.options = OracleConnectionOptions(
            host=host,
            port=port,
            service_name=service_name,
            sid=sid,
            username=username,
            user=user,
            password=password,
            password_env=password_env,
            schema=schema,
            thick_mode=thick_mode,
            client_lib_dir=client_lib_dir,
        )
        self.query = query
        self.table = table
        self.limit = limit

    def load(self) -> pd.DataFrame:
        sql = self.query or _select_from_table(self.table, self.options.schema, self.limit)
        with oracle_connection(self.options) as conn:
            return pd.read_sql(sql, conn)


@contextmanager
def oracle_connection(options: OracleConnectionOptions | dict[str, Any]) -> Iterator[Any]:
    """Open an Oracle connection and close it after use."""

    if isinstance(options, dict):
        options = OracleConnectionOptions(**_connection_only_options(options))

    oracledb = _load_oracledb()
    _maybe_init_thick_mode(oracledb, options)
    dsn = _make_dsn(oracledb, options)
    conn = oracledb.connect(
        user=options.resolved_user,
        password=options.resolved_password,
        dsn=dsn,
    )
    try:
        yield conn
    finally:
        conn.close()


def test_oracle_connection(options: dict[str, Any]) -> dict[str, Any]:
    """Validate credentials with a lightweight query."""

    started = time.perf_counter()
    with oracle_connection(options) as conn:
        mode = "thin" if getattr(conn, "thin", True) else "thick"
        database_version = getattr(conn, "version", None)
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM dual")
            value = cursor.fetchone()[0]
            cursor.execute("SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') FROM dual")
            current_schema = cursor.fetchone()[0]
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    return {
        "ok": value == 1,
        "round_trip_ms": elapsed_ms,
        "current_schema": current_schema,
        "mode": mode,
        "database_version": database_version,
    }


def list_oracle_schemas(options: dict[str, Any]) -> dict[str, Any]:
    """Return schemas visible to the connected account."""

    sql = """
        SELECT DISTINCT owner
        FROM all_tables
        ORDER BY owner
    """
    with oracle_connection(options) as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            schemas = [row[0] for row in cursor.fetchall()]
    return {"schemas": schemas}


def list_oracle_tables(options: dict[str, Any], schema: str | None = None) -> dict[str, Any]:
    """Return table names visible in a schema."""

    schema_name = (schema or options.get("schema") or options.get("username") or options.get("user") or "").upper()
    if not schema_name:
        raise ValueError("schema is required.")
    _validate_identifier(schema_name, "schema")
    sql = """
        SELECT owner, table_name, num_rows
        FROM all_tables
        WHERE owner = :owner
        ORDER BY table_name
    """
    with oracle_connection(options) as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, owner=schema_name)
            tables = [
                {"schema": row[0], "table": row[1], "estimated_rows": row[2]}
                for row in cursor.fetchall()
            ]
    return {"schema": schema_name, "tables": tables}


def list_oracle_columns(options: dict[str, Any], table: str, schema: str | None = None) -> dict[str, Any]:
    """Return column metadata for a table."""

    schema_name = (schema or options.get("schema") or options.get("username") or options.get("user") or "").upper()
    table_name = table.upper()
    _validate_identifier(schema_name, "schema")
    _validate_identifier(table_name, "table")
    sql = """
        SELECT column_name, data_type, nullable, data_length, data_precision, data_scale
        FROM all_tab_columns
        WHERE owner = :owner AND table_name = :table_name
        ORDER BY column_id
    """
    with oracle_connection(options) as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, owner=schema_name, table_name=table_name)
            columns = [
                {
                    "name": row[0],
                    "data_type": row[1],
                    "nullable": row[2] == "Y",
                    "data_length": row[3],
                    "data_precision": row[4],
                    "data_scale": row[5],
                }
                for row in cursor.fetchall()
            ]
    return {"schema": schema_name, "table": table_name, "columns": columns}


def _load_oracledb():
    try:
        import oracledb
    except ImportError as exc:
        raise RuntimeError(
            "Oracle support is not installed. Run `pip install oracledb` in the project virtual environment."
        ) from exc
    return oracledb


def _maybe_init_thick_mode(oracledb: Any, options: OracleConnectionOptions) -> None:
    global _THICK_MODE_INITIALIZED
    if not options.thick_mode or _THICK_MODE_INITIALIZED:
        return
    kwargs = {}
    if options.client_lib_dir:
        kwargs["lib_dir"] = options.client_lib_dir
    oracledb.init_oracle_client(**kwargs)
    _THICK_MODE_INITIALIZED = True


def _make_dsn(oracledb: Any, options: OracleConnectionOptions) -> str:
    if options.service_name:
        return oracledb.makedsn(options.host, options.port, service_name=options.service_name)
    if options.sid:
        return oracledb.makedsn(options.host, options.port, sid=options.sid)
    raise ValueError("Oracle service_name or sid is required.")


def _select_from_table(table: str | None, schema: str | None, limit: int | None) -> str:
    if not table:
        raise ValueError("Oracle connector requires either query or table.")
    table_name = _qualified_name(schema, table)
    sql = f"SELECT * FROM {table_name}"
    if limit:
        sql += f" FETCH FIRST {int(limit)} ROWS ONLY"
    return sql


def _qualified_name(schema: str | None, table: str) -> str:
    table_name = table.upper()
    _validate_identifier(table_name, "table")
    if not schema:
        return table_name
    schema_name = schema.upper()
    _validate_identifier(schema_name, "schema")
    return f"{schema_name}.{table_name}"


def _validate_identifier(value: str, label: str) -> None:
    if not value or not _IDENTIFIER.match(value):
        raise ValueError(f"Invalid Oracle {label} identifier: {value!r}")


def _connection_only_options(options: dict[str, Any]) -> dict[str, Any]:
    allowed = set(OracleConnectionOptions.__dataclass_fields__)
    return {key: value for key, value in options.items() if key in allowed}
