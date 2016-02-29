#!/usr/bin/env bash

echo "Cleaning..."
rm -rf test-* scripts/test-*.log

echo "Running Tests:"

num_tests=$(ls scripts/test-circle-* | wc -l)
for i in ./scripts/test-circle-16.sh; do
  echo -n "$i of $num_tests... "
  start=$(date +"%s")
  $i > "$i".log 2>&1
  res=$?
  stop=$(date +"%s")
  diff=$(($stop-$start))
  diff=$(echo $diff | awk '{print int($1/60)":"int($1%60)}')

  if [ $res -eq 0 ]; then
    echo -n "✓ ($diff)"
  else
    echo -n "✗ ($diff)"
    echo ""
    cat "$i".log
    exit 1
  fi
  echo ""
done

echo -n "concluded"
