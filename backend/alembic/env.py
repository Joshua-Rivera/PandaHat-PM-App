from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

from app.config import get_settings

config = context.config
if config.config_file_name is not None:
    # Keep app loggers alive; the default would silence every logger created before migrations ran.
    fileConfig(config.config_file_name, disable_existing_loggers=False)


def run_migrations_online() -> None:
    url = config.attributes.get("database_url") or get_settings().DATABASE_URL
    engine = create_engine(url)
    with engine.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run_migrations_online()
