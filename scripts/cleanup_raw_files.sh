#!/bin/sh
# Prunes old raw sensor dump files (*.RAW) from /persistent to prevent disk exhaustion.
# The biometrics stream (biometrics/stream/stream.py) writes these continuously and
# nothing else on the device prunes them - once a file has been processed into the
# vitals/sleep_records/movement tables it's safe to delete. Keeps the newest KEEP files
# as a buffer (in case the most recent night hasn't been analyzed yet) and removes the
# rest. Intended to run daily via a systemd timer - see setup instructions in the repo.

KEEP=40

ls -t /persistent/*.RAW 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
