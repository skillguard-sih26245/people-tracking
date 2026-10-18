import pytest
from app.compliance import evaluate_attendance_compliance, evaluate_infra_compliance, evaluate_operability_compliance, check_persistence

def test_evaluate_attendance_compliance():
    # Compliant (0 deviation)
    lvl, ratio = evaluate_attendance_compliance(20, 20)
    assert lvl == "normal"
    assert ratio == 0.0

    # Warning (25 reported vs 19 observed -> 24% deviation)
    lvl, ratio = evaluate_attendance_compliance(25, 19)
    assert lvl == "warning"

    # Critical (25 reported vs 12 observed -> 52% deviation)
    lvl, ratio = evaluate_attendance_compliance(25, 12)
    assert lvl == "critical"

def test_evaluate_infra_compliance():
    assert evaluate_infra_compliance(0.90)[0] == "normal"
    assert evaluate_infra_compliance(0.75)[0] == "warning"
    assert evaluate_infra_compliance(0.50)[0] == "critical"

def test_check_persistence():
    breaches_false = [False] * 20
    assert check_persistence(breaches_false) is False

    breaches_true = [True] * 20
    assert check_persistence(breaches_true) is True

    short_breaches = [True] * 10
    assert check_persistence(short_breaches) is False
