#!/usr/bin/env python3
import redis
import argparse
import os
import sys
import time

BANNER = """
    ╔══════════════════════════════════════════╗
    ║   MULTI-SOURCE BREACH LOADER v2.0        ║
    ╚══════════════════════════════════════════╝
"""

def parse_arguments():
    parser = argparse.ArgumentParser(description="Load a specific breach list into Redis.")
    
    parser.add_argument("-w", "--wordlist", required=True, help="Path to the password file")
    parser.add_argument("-n", "--name", required=True, help="Display Name for this breach (e.g. 'RockYou', 'Adobe')")
    parser.add_argument("-c", "--capacity", type=int, default=10000000, help="Estimated count (default: 10m)")
    
    return parser.parse_args()

def main():
    print(BANNER)
    args = parse_arguments()
    
    # Create a cleaner key name: "leak:RockYou"
    filter_key = f"leak:{args.name}"

    if not os.path.exists(args.wordlist):
        print(f"[!] Error: File {args.wordlist} not found.")
        sys.exit(1)

    r = redis.Redis(host='localhost', port=6379, decode_responses=True)
    
    try:
        # Create specific filter for this breach
        # We use a smaller error rate (0.001)
        try:
            r.execute_command('BF.RESERVE', filter_key, '0.001', str(args.capacity))
            print(f"[+] Created new database: {filter_key}")
        except redis.ResponseError as e:
            if "exists" in str(e):
                print(f"[*] Database {filter_key} already exists. Appending...")
            else:
                raise e

        print(f"[*] Loading data from {args.wordlist}...")
        
        pipe = r.pipeline()
        count = 0
        
        with open(args.wordlist, 'r', encoding='latin-1', errors='ignore') as f:
            for line in f:
                pwd = line.strip()
                if pwd:
                    pipe.execute_command('BF.ADD', filter_key, pwd)
                    count += 1
                    if count % 10000 == 0:
                        pipe.execute()
                        sys.stdout.write(f"\r[>] Loaded {count} passwords...")
                        sys.stdout.flush()
        
        pipe.execute()
        print(f"\n[SUCCESS] Finished! Added {count} passwords to '{args.name}' database.")
        
    except Exception as e:
        print(f"\n[!] Error: {e}")

if __name__ == "__main__":
    main()
