"""
Meter profile definitions for the ProVigil simulation fleet.

Each profile describes a meter's identity, location, load characteristics,
and optional failure scenario to be injected during simulation.
"""

import random
from dataclasses import dataclass, field, asdict
from typing import Optional, List

FAILURE_SCENARIOS = [
    "loose_terminal",
    "comm_loss",
    "sensor_fault",
    "battery_fault",
    "consumption_anomaly",
]

METER_TYPES = ["residential", "commercial", "industrial"]

# Base-load ranges per meter type (kW)
BASE_LOAD_RANGES = {
    "residential": (0.5, 3.0),
    "commercial": (5.0, 20.0),
    "industrial": (50.0, 200.0),
}

# Name prefixes for generating human-readable names
RESIDENTIAL_NAMES = [
    "Sector-{n} Apartment",
    "Block-{n} Housing",
    "Colony-{n} Residence",
    "Vasant Kunj Unit-{n}",
    "Dwarka Flat-{n}",
    "Rohini House-{n}",
    "Saket Villa-{n}",
    "Lajpat Nagar Home-{n}",
    "Hauz Khas Apt-{n}",
    "Janakpuri Residence-{n}",
]

COMMERCIAL_NAMES = [
    "Connaught Place Shop-{n}",
    "Nehru Place Office-{n}",
    "Karol Bagh Market-{n}",
    "Rajouri Garden Mall-{n}",
    "Sarojini Nagar Store-{n}",
    "Pitampura Business-{n}",
    "Noida IT Park-{n}",
    "Gurgaon Tower-{n}",
]

INDUSTRIAL_NAMES = [
    "Okhla Industrial-{n}",
    "Naraina Factory-{n}",
    "Bawana Plant-{n}",
    "Mundka Warehouse-{n}",
    "Patparganj Unit-{n}",
    "Faridabad Works-{n}",
]


@dataclass
class MeterProfile:
    """Describes a single simulated meter."""

    meter_id: str
    name: str
    location_lat: float
    location_lng: float
    base_load_kw: float
    meter_type: str
    failure_scenario: Optional[str] = None
    failure_start_hour: Optional[float] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _random_name(meter_type: str, index: int) -> str:
    """Generate a human-readable name for the given meter type."""
    if meter_type == "residential":
        template = random.choice(RESIDENTIAL_NAMES)
    elif meter_type == "commercial":
        template = random.choice(COMMERCIAL_NAMES)
    else:
        template = random.choice(INDUSTRIAL_NAMES)
    return template.format(n=index)


def generate_meter_fleet(n_meters: int = 50, seed: int = 42) -> List[MeterProfile]:
    """
    Generate a fleet of meter profiles.

    About 60 % are healthy (no failure scenario); the remainder are split
    across the five failure types.

    Parameters
    ----------
    n_meters : int
        Total number of meters to create.
    seed : int
        Random seed for reproducibility.

    Returns
    -------
    list[MeterProfile]
    """
    rng = random.Random(seed)

    # Type distribution: ~70 % residential, ~20 % commercial, ~10 % industrial
    type_weights = [0.70, 0.20, 0.10]
    meters: List[MeterProfile] = []

    n_healthy = int(n_meters * 0.60)
    n_faulty = n_meters - n_healthy

    # Pre-assign failure scenarios round-robin then shuffle
    failure_assignments: List[Optional[str]] = [None] * n_healthy
    for i in range(n_faulty):
        failure_assignments.append(FAILURE_SCENARIOS[i % len(FAILURE_SCENARIOS)])
    rng.shuffle(failure_assignments)

    for i in range(n_meters):
        meter_id = f"MTR-{i + 1:03d}"

        # Pick type
        r = rng.random()
        if r < type_weights[0]:
            meter_type = "residential"
        elif r < type_weights[0] + type_weights[1]:
            meter_type = "commercial"
        else:
            meter_type = "industrial"

        lo, hi = BASE_LOAD_RANGES[meter_type]
        base_load = round(rng.uniform(lo, hi), 2)

        # Location spread around Delhi NCR
        lat = round(rng.uniform(28.50, 28.85), 6)
        lng = round(rng.uniform(76.95, 77.35), 6)

        name = _random_name(meter_type, i + 1)

        failure = failure_assignments[i]
        failure_start = None
        if failure is not None:
            # Failure begins between 0.5 h and 3 h into the simulation
            failure_start = round(rng.uniform(0.5, 3.0), 2)

        meters.append(
            MeterProfile(
                meter_id=meter_id,
                name=name,
                location_lat=lat,
                location_lng=lng,
                base_load_kw=base_load,
                meter_type=meter_type,
                failure_scenario=failure,
                failure_start_hour=failure_start,
            )
        )

    return meters


def get_demo_meters() -> List[MeterProfile]:
    """
    Return a curated set of 10 meters useful for live demonstrations.

    - 7 healthy meters (mix of residential / commercial / industrial)
    - 1 loose-terminal meter   (fails early – visible within minutes at 60x)
    - 1 comm-loss meter        (fails mid-demo)
    - 1 consumption-anomaly    (theft / malfunction pattern)
    """
    meters = [
        # ---- Healthy residential ----
        MeterProfile(
            meter_id="MTR-D01",
            name="Demo Residence Alpha",
            location_lat=28.6139,
            location_lng=77.2090,
            base_load_kw=1.8,
            meter_type="residential",
        ),
        MeterProfile(
            meter_id="MTR-D02",
            name="Demo Residence Beta",
            location_lat=28.6350,
            location_lng=77.2250,
            base_load_kw=2.5,
            meter_type="residential",
        ),
        MeterProfile(
            meter_id="MTR-D03",
            name="Demo Residence Gamma",
            location_lat=28.6500,
            location_lng=77.1700,
            base_load_kw=1.2,
            meter_type="residential",
        ),
        # ---- Healthy commercial ----
        MeterProfile(
            meter_id="MTR-D04",
            name="Demo Office Tower A",
            location_lat=28.6280,
            location_lng=77.2180,
            base_load_kw=12.0,
            meter_type="commercial",
        ),
        MeterProfile(
            meter_id="MTR-D05",
            name="Demo Retail Mall B",
            location_lat=28.5700,
            location_lng=77.2500,
            base_load_kw=8.5,
            meter_type="commercial",
        ),
        # ---- Healthy industrial ----
        MeterProfile(
            meter_id="MTR-D06",
            name="Demo Factory Unit 1",
            location_lat=28.7100,
            location_lng=77.1000,
            base_load_kw=110.0,
            meter_type="industrial",
        ),
        MeterProfile(
            meter_id="MTR-D07",
            name="Demo Warehouse Unit 2",
            location_lat=28.7250,
            location_lng=77.1200,
            base_load_kw=75.0,
            meter_type="industrial",
        ),
        # ---- Failure scenarios ----
        MeterProfile(
            meter_id="MTR-D08",
            name="Demo Loose Terminal",
            location_lat=28.6200,
            location_lng=77.2300,
            base_load_kw=2.0,
            meter_type="residential",
            failure_scenario="loose_terminal",
            failure_start_hour=0.25,
        ),
        MeterProfile(
            meter_id="MTR-D09",
            name="Demo Comm Loss",
            location_lat=28.6000,
            location_lng=77.2000,
            base_load_kw=6.0,
            meter_type="commercial",
            failure_scenario="comm_loss",
            failure_start_hour=1.0,
        ),
        MeterProfile(
            meter_id="MTR-D10",
            name="Demo Theft Suspect",
            location_lat=28.5900,
            location_lng=77.2600,
            base_load_kw=1.5,
            meter_type="residential",
            failure_scenario="consumption_anomaly",
            failure_start_hour=0.5,
        ),
    ]
    return meters
