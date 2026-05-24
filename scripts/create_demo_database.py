"""로컬 시연용 SQLite 데이터베이스를 생성한다."""

import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd


def main() -> None:
    """세 가지 태스크를 모두 테스트할 수 있는 synthetic table을 만든다."""

    rng = np.random.default_rng(42)
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    db_path = data_dir / "demo_sml.db"

    churn = pd.DataFrame(
        {
            "customer_id": range(1, 121),
            "age": rng.integers(18, 75, 120),
            "monthly_fee": rng.normal(65, 18, 120).round(2),
            "tenure_months": rng.integers(1, 72, 120),
            "contract_type": rng.choice(["monthly", "annual", "two_year"], 120, p=[0.55, 0.3, 0.15]),
            "region": rng.choice(["seoul", "busan", "incheon", "daegu"], 120),
        }
    )
    # contract/monthly_fee를 일부 반영해 완전히 무작위가 아닌 churn label을 만든다.
    churn["churn"] = (
        (churn["contract_type"].eq("monthly").astype(int) + (churn["monthly_fee"] > 75).astype(int) + rng.normal(0, 1, 120))
        > 1.25
    ).astype(int)
    churn.loc[5, "monthly_fee"] = np.nan
    churn.loc[18, "region"] = None

    houses = pd.DataFrame(
        {
            "house_id": range(1, 101),
            "area_m2": rng.normal(85, 25, 100).round(1),
            "rooms": rng.integers(1, 6, 100),
            "distance_to_station": rng.gamma(2.0, 1.2, 100).round(2),
            "district": rng.choice(["gangnam", "mapo", "jongno", "songpa"], 100),
        }
    )
    # 회귀 예제가 의미 있는 점수를 내도록 area/rooms/distance 기반 price를 생성한다.
    houses["price"] = (
        houses["area_m2"] * 8.5
        + houses["rooms"] * 30
        - houses["distance_to_station"] * 18
        + rng.normal(0, 45, 100)
    ).round(2)
    houses.loc[3, "area_m2"] = np.nan

    campaign = pd.DataFrame(
        {
            "campaign_id": range(1, 111),
            "budget": rng.normal(12000, 3500, 110).round(0),
            "impressions": rng.normal(180000, 45000, 110).round(0),
            "channel": rng.choice(["search", "social", "display", "email"], 110),
            "season": rng.choice(["spring", "summer", "fall", "winter"], 110),
        }
    )
    # 멀티 타겟 회귀용으로 revenue와 conversions를 동시에 만든다.
    campaign["revenue"] = (campaign["budget"] * rng.normal(1.8, 0.25, 110) + rng.normal(0, 2500, 110)).round(2)
    campaign["conversions"] = (campaign["impressions"] / rng.normal(850, 120, 110) + rng.normal(0, 30, 110)).round(0)
    campaign.loc[8, "budget"] = np.nan

    with sqlite3.connect(db_path) as conn:
        churn.to_sql("customer_churn", conn, if_exists="replace", index=False)
        houses.to_sql("house_prices", conn, if_exists="replace", index=False)
        campaign.to_sql("ad_campaign", conn, if_exists="replace", index=False)

    print(f"Created demo database: {db_path}")


if __name__ == "__main__":
    main()
