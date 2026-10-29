import sys
from per_aspera.__main__ import main

if __name__=='__main__':
    sys.argv.insert(1,'--pioneers')
    main()
