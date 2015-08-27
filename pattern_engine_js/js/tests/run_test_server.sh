#!/bin/bash

if [ "$(uname)" == "Darwin" ]; then
  # Open browser after 2 seconds.
  (sleep 2; open http://localhost:8000/js/tests/qunit.html) &
else
  echo "Open http://localhost:8000/js/tests/qunit.html in your browser."
fi
cd ../..
python -m SimpleHTTPServer
