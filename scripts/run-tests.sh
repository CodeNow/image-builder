#!/usr/bin/env bash

echo "Cleaning..."
rm -rf test-* scripts/test-*.log

echo "Running Tests:"

num_tests=$(ls scripts/test-circle-* | wc -l)
for i in $(seq 1 $num_tests); do
  docker rm $(docker ps -aq) > /dev/null 2>&1
  if [ $i -lt 10 ]; then
    i="0"$i
  fi
  echo -n "$i of $num_tests... "
  start=$(date +"%s")
  ./scripts/test-circle-"$i".sh > ./scripts/test-"$i".log 2>&1
  res=$?
  stop=$(date +"%s")
  diff=$(($stop-$start))
  diff=$(echo $diff | awk '{print int($1/60)":"int($1%60)}')

  if [ $res -eq 0 ]; then
    echo -n "✓ ($diff)"
  else
    echo -n "✗ ($diff)"
    echo ""
    cat ./scripts/test-"$i".log
    exit 1
  fi
  echo ""
done

echo -n "concluded"
