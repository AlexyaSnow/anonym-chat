from tikrec.watchlist import Watchlist


def test_add_remove_and_persist(tmp_path):
    path = tmp_path / "wl.json"
    wl = Watchlist(path)

    assert wl.add("Charli", 100) is True
    assert wl.add("charli", 100) is False  # insensible à la casse
    assert "CHARLI" in wl
    assert wl.chat_id_for("charli") == 100
    assert wl.usernames() == ["charli"]

    # Persistance : un nouvel objet relit le fichier
    wl2 = Watchlist(path)
    assert wl2.usernames() == ["charli"]
    assert wl2.chat_id_for("charli") == 100

    assert wl2.remove("charli") is True
    assert wl2.remove("charli") is False
    assert len(wl2) == 0


def test_load_corrupt_file(tmp_path):
    path = tmp_path / "wl.json"
    path.write_text("not json {{", encoding="utf-8")
    wl = Watchlist(path)
    assert wl.usernames() == []
