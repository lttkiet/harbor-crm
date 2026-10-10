## 2026-10-07 - SQL LIKE Injection in TypeORM query builder
**Vulnerability:** Unsanitized user input was directly inserted into a `LIKE` clause with wildcards (`%${search}%`) in TypeORM's `andWhere` method, allowing attackers to perform LIKE Injection by supplying wildcards (`%`, `_`, `\`) in their input.
**Learning:** TypeORM's query builder does not automatically escape literal wildcards when injecting parameters into `LIKE` clauses.
**Prevention:** Always manually escape wildcard characters (`%`, `_`, `\`) using regex before injecting them into a `LIKE` parameter.
