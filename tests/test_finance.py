from copy import deepcopy
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
import json
import tempfile
import unittest
from per_aspera import finance
from per_aspera.engine import Simulation, RuleError
from per_aspera.persistence import save, load, validate, SaveError
from per_aspera.definitions import SCENARIO
from per_aspera.demo import run_policy
from per_aspera.presentation import minimum_remaining_cost
from test_simulation import prepare_fixture


class FinanceTests(unittest.TestCase):
    def test_public_forecast_excludes_already_committed_work(self):
        s=Simulation.new(11)
        self.assertEqual(minimum_remaining_cost(s.briefing()),765000)
        s.order_test('integration')
        self.assertEqual(minimum_remaining_cost(s.briefing()),675000)
        s.order_test('crew','bennett')
        self.assertEqual(minimum_remaining_cost(s.briefing()),640000)

    def test_opening_appropriation_reconciles_without_larger_budget(self):
        s = Simulation.new(11)
        f = s.briefing()['finances']
        self.assertEqual(f['appropriated'], 1800000)
        self.assertEqual(f['programme_allocation'], 1500000)
        self.assertEqual(f['reserve'], 300000)
        self.assertEqual(f['programme_available'] + f['reserve'], s.state.budget)
        validate(s.state)

    def test_zero_reserve_does_not_stop_programme_or_committed_work(self):
        s = Simulation.new(11)
        s.reallocate('reserve', 'engineering', 300000, 'Contingency authority allocated explicitly')
        s.order_test('flow')
        before = s.state.budget
        s.advance(18)
        self.assertFalse(s.state.jobs)
        self.assertEqual(s.state.budget, before)
        s.order_test('thermal')
        s.advance(12)
        validate(s.state)

    def test_funded_flight_runs_with_zero_reserve(self):
        s=Simulation.new(11)
        s.reallocate('reserve','engineering',300000,'Allocate remaining contingency authority')
        prepare_fixture(s)
        s.advance_to_next()
        s.launch()
        balance=s.state.budget
        while s.state.stage=='flight':
            s.advance_to_next()
        self.assertEqual(s.state.budget,balance)
        self.assertEqual(s.state.finance['reserve'],0)
        self.assertEqual(s.state.results[-1]['outcome'],'objective_complete')
        validate(s.state)

    def test_unfunded_test_is_atomic_and_does_not_touch_reserve(self):
        s = Simulation.new(11)
        s.reallocate('engineering', 'operations', 735000, 'Defer investigation')
        before = asdict(s.state)
        with self.assertRaisesRegex(RuleError, 'short'):
            s.order_test('flow')
        self.assertEqual(before, asdict(s.state))

    def test_obligation_and_completion_charge_only_once(self):
        s = Simulation.new(11)
        s.order_test('flow')
        f = s.state.finance
        self.assertEqual(s.state.budget, 1745000)
        self.assertEqual(f['lines']['engineering']['committed'], 55000)
        s.advance(18)
        self.assertEqual(s.state.budget, 1745000)
        self.assertEqual(f['lines']['engineering']['committed'], 0)
        self.assertEqual(f['lines']['engineering']['expended'], 55000)
        self.assertEqual(len(f['transactions']), 1)
        self.assertEqual(f['transactions'][0]['purpose'], SCENARIO['tests']['flow']['name'])
        validate(s.state)

    def test_delegated_tests_have_one_charge_each_not_a_second_envelope_charge(self):
        s = Simulation.new(11)
        s.delegate(spending_limit=250000, hours_limit=72)
        s.advance(80)
        charges = [t for t in s.state.finance['transactions'] if t['kind'] == 'obligation']
        self.assertEqual(1800000-s.state.budget, sum(t['amount'] for t in charges))
        self.assertEqual(len(charges), len(s.state.delegation['completed']))
        validate(s.state)

    def test_review_and_flight_settle_without_double_charge(self):
        s = Simulation.new(11)
        prepare_fixture(s)
        self.assertEqual(1800000-s.state.budget, 155000)
        s.advance_to_next()
        s.launch()
        self.assertEqual(s.state.finance['lines']['operations']['committed'], 100000)
        after = s.state.budget
        while s.state.stage == 'flight':
            s.advance_to_next()
        self.assertEqual(s.state.budget, after)
        self.assertEqual(s.state.finance['lines']['operations']['expended'], 100000)
        validate(s.state)

    def test_reallocation_cannot_defund_commitments_or_cross_appropriations(self):
        s = Simulation.new(11)
        s.order_test('flow')
        with self.assertRaises(RuleError):
            s.reallocate('engineering','operations',700000,'Attempt to use committed money')
        self.assertEqual(s.state.finance['lines']['engineering']['committed'],55000)
        s.state.finance['lines']['operations']['appropriation'] = 'facilities'
        before = deepcopy(s.state.finance)
        with self.assertRaisesRegex(RuleError, 'statutory'):
            s.reallocate('engineering','operations',1,'Different purpose')
        self.assertEqual(before,s.state.finance)

    def test_reallocation_preserves_total_and_documents_tradeoff(self):
        s = Simulation.new(11)
        before = s.state.budget
        s.reallocate('operations','engineering',100000,'Defer a future flight')
        self.assertEqual(s.state.budget,before)
        self.assertEqual(s.state.finance['lines']['operations']['allocation'],200000)
        self.assertEqual(s.state.finance['transactions'][-1]['source'],'operations')
        validate(s.state)

    def test_pending_request_never_creates_money_or_waives_safety(self):
        s = Simulation.new(11)
        s.request_funding('engineering',100000,'Additional controlled comparison')
        s.advance(500)
        self.assertEqual(s.state.budget,1800000)
        self.assertEqual(s.state.finance['requests'][0]['status'],'pending')
        with self.assertRaises(RuleError):
            s.launch()
        with self.assertRaises(RuleError):
            s.request_funding('engineering',100000,'Repeat')
        validate(s.state)

    def test_fiscal_year_transition_preserves_no_year_funds_and_jobs(self):
        s = Simulation.new(11)
        boundary = int((datetime(1969,7,1)-datetime.fromisoformat(SCENARIO['start'])).total_seconds()/3600)
        s.advance(boundary-6)
        s.order_test('flow')
        balance = s.state.budget
        s.advance(6)
        self.assertEqual(s.state.finance['fiscal_year'],1970)
        self.assertEqual(s.state.budget,balance)
        self.assertEqual(s.state.finance['lines']['engineering']['committed'],55000)
        s.advance(12)
        self.assertEqual(s.state.budget,balance)
        validate(s.state)

    def test_no_passive_or_recurring_expenses(self):
        s = Simulation.new(11)
        s.advance(10000)
        self.assertEqual(s.state.budget,1800000)
        self.assertFalse(s.state.finance['transactions'])
        validate(s.state)

    def test_save_load_ledger_and_legacy_migration_preserve_balance(self):
        s = Simulation.new(11)
        s.order_test('flow')
        s.advance(6)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            path=Path(folder)/'save.json'
            save(s.state,path)
            self.assertEqual(json.dumps(asdict(load(path)),sort_keys=True),json.dumps(asdict(s.state),sort_keys=True))
            old=asdict(s.state)
            old.pop('finance')
            old['version']=1
            path.write_text(json.dumps(old))
            migrated=load(path)
            self.assertEqual(migrated.budget,s.state.budget)
            self.assertEqual(migrated.finance['lines']['engineering']['committed'],55000)
            self.assertEqual(migrated.finance['transactions'][0]['remaining'],1745000)
            Simulation(migrated).advance(12)
            validate(migrated)

    def test_bad_ledger_and_unexplained_funds_are_rejected(self):
        s=Simulation.new(11)
        s.order_test('flow')
        s.state.finance['transactions'][0]['remaining']+=1
        with self.assertRaises(ValueError):
            validate(s.state)

    def test_programme_cancellation_settles_contracts_without_refund(self):
        s=Simulation.new(11)
        s.order_test('flow')
        balance=s.state.budget
        s.cancel('No viable funded scope remains')
        self.assertFalse(s.state.jobs)
        self.assertEqual(s.state.budget,balance)
        validate(s.state)

    def test_representative_campaigns_and_higher_spend_pressure(self):
        for rounds,expected in ((1,1570000),(2,1600000)):
            s=run_policy(Simulation.new(11),rounds)
            self.assertEqual(s.state.stage,'closed')
            self.assertEqual(1800000-s.state.budget,expected)
            validate(s.state)
        s=Simulation.new(11)
        with self.assertRaises(RuleError):
            run_policy(s,3)
        self.assertEqual(len(s.state.results),2)
        self.assertEqual(s.state.budget,200000)
        self.assertEqual(finance.available(s.state.finance['lines']['operations']),100000)
        validate(s.state)


if __name__ == '__main__':
    unittest.main()
