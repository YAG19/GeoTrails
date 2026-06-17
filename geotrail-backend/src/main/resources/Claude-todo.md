- Frontend type-checks clean: tsc --noEmit -p tsconfig.app.json → EXIT=0.
    - Backend I could not compile here (this box has Java 17 + no Maven; the project needs Java 21) — so the Java changes are unbuilt. Run mvn -q compile (or your deploy build) on the Java 21 environment to confirm.

  One design note: the request field is since (a date floor), and indexing covers everything on/after it — so the complete event echoes since back rather than implying a single day was indexed. If you'd rather index exactly one
  day, that's a separate change to the query in TimelineSourceRepository.