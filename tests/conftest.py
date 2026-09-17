"""
Central test configuration.

Each test file owns its own in-memory SQLite engine (StaticPool).
This conftest restores the correct get_db override before every test
and resets the schema after every test, so cross-module override
contamination is impossible regardless of collection order.
"""
import pytest
from app.main import app
from app.db.init_db import get_db


@pytest.fixture(autouse=True)
def _restore_db_override(request):
    """
    Before each test: re-install the override from the test's own module
    (in case a previously collected module overwrote it).
    After each test: drop+recreate that module's schema for isolation.
    """
    mod = request.module
    override = getattr(mod, "override_get_db", None)
    engine = getattr(mod, "engine", None)

    if override and engine:
        app.dependency_overrides[get_db] = override

    yield

    if engine:
        from app.db.models import Base
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
