import sys
from pathlib import Path

# Ensure project root is in python path for pytest
root_dir = Path(__file__).parent
sys.path.insert(0, str(root_dir))
