import pytest

from tikrec.config import Config, _parse_user_ids


def test_parse_user_ids():
    assert _parse_user_ids("1, 2 ;3") == {1, 2, 3}
    assert _parse_user_ids("") == set()
    assert _parse_user_ids("abc, 5") == {5}


def test_is_allowed_empty_allows_everyone():
    cfg = Config(bot_token="x", output_dir=".", allowed_users=set())
    assert cfg.is_allowed(123) is True


def test_is_allowed_restricts():
    cfg = Config(bot_token="x", output_dir=".", allowed_users={42})
    assert cfg.is_allowed(42) is True
    assert cfg.is_allowed(99) is False


def test_from_env_requires_token(monkeypatch):
    monkeypatch.delenv("BOT_TOKEN", raising=False)
    with pytest.raises(RuntimeError):
        Config.from_env(dotenv="/nonexistent/.env")


def test_from_env_reads_values(monkeypatch, tmp_path):
    monkeypatch.setenv("BOT_TOKEN", "tok")
    monkeypatch.setenv("OUTPUT_DIR", str(tmp_path / "rec"))
    monkeypatch.setenv("CHECK_INTERVAL", "30")
    monkeypatch.setenv("ALLOWED_USERS", "7,8")
    cfg = Config.from_env(dotenv="/nonexistent/.env")
    assert cfg.bot_token == "tok"
    assert cfg.check_interval == 30
    assert cfg.allowed_users == {7, 8}
    assert cfg.upload_limit_bytes == 49 * 1024 * 1024
