from __future__ import annotations


def _make_section(client, headers, name: str) -> dict:
    resp = client.post("/api/sections", headers=headers, json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


def _make_habit(client, headers, name: str) -> dict:
    resp = client.post("/api/habits", headers=headers, json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_all_endpoints_require_auth(client):
    for path in [
        "/api/sections",
        "/api/sections/board",
        "/api/tasks",
        "/api/tasks/counts",
        "/api/habits",
        "/api/habits/streaks",
    ]:
        r = client.get(path)
        assert r.status_code == 401, f"{path} did not require auth (got {r.status_code})"


def test_user_b_cannot_see_user_a_section(client, user_a, user_b):
    a_section = _make_section(client, user_a["auth_headers"], "A's board")

    board_b = client.get("/api/sections/board", headers=user_b["auth_headers"])
    assert board_b.status_code == 200
    b_body = board_b.json()
    assert all(s["id"] != a_section["id"] for s in b_body)

    board_a = client.get("/api/sections/board", headers=user_a["auth_headers"])
    assert board_a.status_code == 200
    a_body = board_a.json()
    assert any(s["id"] == a_section["id"] for s in a_body)


def test_user_b_gets_404_on_user_a_section(client, user_a, user_b):
    a_section = _make_section(client, user_a["auth_headers"], "A's board")
    resp = client.patch(
        f"/api/sections/{a_section['id']}",
        headers=user_b["auth_headers"],
        json={"name": "hijack"},
    )
    assert resp.status_code == 404

    delete = client.delete(
        f"/api/sections/{a_section['id']}", headers=user_b["auth_headers"]
    )
    assert delete.status_code == 404


def test_user_b_cannot_see_user_a_tasks(client, user_a, user_b):
    a_section = _make_section(client, user_a["auth_headers"], "A's board")
    task = client.post(
        "/api/tasks",
        headers=user_a["auth_headers"],
        json={"title": "A's secret task", "section_id": a_section["id"]},
    )
    assert task.status_code == 201, task.text
    task_id = task.json()["id"]

    listed = client.get("/api/tasks", headers=user_b["auth_headers"])
    assert listed.status_code == 200
    assert all(t["id"] != task_id for t in listed.json())

    lookup = client.get(f"/api/tasks/{task_id}", headers=user_b["auth_headers"])
    assert lookup.status_code == 404

    toggle = client.patch(
        f"/api/tasks/{task_id}/toggle", headers=user_b["auth_headers"]
    )
    assert toggle.status_code == 404


def test_task_creation_rejected_when_section_belongs_to_other_user(
    client, user_a, user_b
):
    a_section = _make_section(client, user_a["auth_headers"], "A's board")
    resp = client.post(
        "/api/tasks",
        headers=user_b["auth_headers"],
        json={"title": "B tries to plant in A", "section_id": a_section["id"]},
    )
    assert resp.status_code == 404


def test_user_b_cannot_see_user_a_habits(client, user_a, user_b):
    habit_a = _make_habit(client, user_a["auth_headers"], "A's habit")

    listed = client.get("/api/habits", headers=user_b["auth_headers"])
    assert listed.status_code == 200
    assert all(h["id"] != habit_a["id"] for h in listed.json())

    update = client.patch(
        f"/api/habits/{habit_a['id']}",
        headers=user_b["auth_headers"],
        json={"name": "hijack"},
    )
    assert update.status_code == 404

    delete = client.delete(
        f"/api/habits/{habit_a['id']}", headers=user_b["auth_headers"]
    )
    assert delete.status_code == 404


def test_user_b_cannot_toggle_user_a_habit_log(client, user_a, user_b):
    habit_a = _make_habit(client, user_a["auth_headers"], "A's habit")
    from datetime import date

    today = date.today().isoformat()
    resp = client.post(
        f"/api/habits/{habit_a['id']}/logs",
        headers=user_b["auth_headers"],
        json={"date": today},
    )
    assert resp.status_code == 404


def test_task_counts_scoped_per_user(client, user_a, user_b):
    from datetime import date

    a_section = _make_section(client, user_a["auth_headers"], "A")
    client.post(
        "/api/tasks",
        headers=user_a["auth_headers"],
        json={
            "title": "A today",
            "section_id": a_section["id"],
            "scheduled_for": date.today().isoformat(),
        },
    )

    counts_a = client.get("/api/tasks/counts", headers=user_a["auth_headers"])
    counts_b = client.get("/api/tasks/counts", headers=user_b["auth_headers"])
    assert counts_a.status_code == 200 and counts_b.status_code == 200
    assert counts_a.json()["today"] >= 1
    assert counts_b.json()["today"] == 0


def test_analytics_scoped_per_user(client, user_a, user_b):
    a_section = _make_section(client, user_a["auth_headers"], "A")
    client.post(
        "/api/tasks",
        headers=user_a["auth_headers"],
        json={"title": "task 1", "section_id": a_section["id"]},
    )
    a_stats = client.get("/api/analytics/tasks", headers=user_a["auth_headers"])
    b_stats = client.get("/api/analytics/tasks", headers=user_b["auth_headers"])
    assert a_stats.status_code == 200 and b_stats.status_code == 200
    assert a_stats.json()["total"] >= 1
    assert b_stats.json()["total"] == 0
