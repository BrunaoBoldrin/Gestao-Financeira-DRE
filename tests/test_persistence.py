import unittest

from backend.persistence import _validated_entities


class PersistenceValidationTests(unittest.TestCase):
    def test_dre_rows_use_financial_code_as_stable_identifier(self):
        rows = [
            {"codigo": "1", "descricao": "Receita bruta"},
            {"codigo": "2", "descricao": "Deduções"},
        ]

        self.assertEqual(
            _validated_entities("dreData", rows),
            [("1", rows[0]), ("2", rows[1])],
        )

    def test_dre_rows_still_reject_duplicate_codes(self):
        rows = [
            {"codigo": "1", "descricao": "Receita bruta"},
            {"codigo": "1", "descricao": "Outra linha"},
        ]

        with self.assertRaisesRegex(ValueError, 'ID duplicado em "dreData": 1'):
            _validated_entities("dreData", rows)


if __name__ == "__main__":
    unittest.main()
