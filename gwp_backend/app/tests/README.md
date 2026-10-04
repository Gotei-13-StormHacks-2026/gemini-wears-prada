# Running tests

Run everything from `gwp_backend` (the folder that contains `app`):

```powershell
python -m pytest
```

Run one file:

```powershell
python -m pytest app/tests/test_outfit_algo.py
```

Run one test:

```powershell
python -m pytest "app/tests/test_outfit_algo.py::test_build_outfit_requires_top"
```

Stop at the first failure and show test names:

```powershell
python -m pytest -x -v
```

First time only: `python -m pip install -r requirements.txt`
