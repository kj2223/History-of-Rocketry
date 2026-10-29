"""Dedicated portable entry point for the independent NASA-formation prototype."""
import sys
from per_aspera.__main__ import main

if __name__=='__main__':
    if '--founding' not in sys.argv and '--founding-demo' not in sys.argv:sys.argv.insert(1,'--founding')
    main()
