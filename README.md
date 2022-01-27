<!--

@license Apache-2.0

Copyright (c) 2022 The Stdlib Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

-->

---

# Deno Bundle

> GitHub action to create a Deno bundle for an npm package.

---

## Example Workflow

```yml
# Workflow name:
name: deno-bundle

# Workflow triggers:
on:
  workflow_dispatch:

# Workflow jobs:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2
      - name: Bundle `@stdlib/assert-is-nan`
        uses: ./
        with:
          pkg: "@stdlib/assert-is-nan"
```

## Inputs

-   `pkg`: *(optional)* a string containing the name of the npm package to bundle. Defaults to the package in the current repository.

## License

See [LICENSE][stdlib-license].


## Copyright

Copyright &copy; 2022. The Stdlib [Authors][stdlib-authors].

<!-- Section for all links. Make sure to keep an empty line after the `section` element and another before the `/section` close. -->

<section class="links">

[stdlib]: https://github.com/stdlib-js/stdlib

[stdlib-authors]: https://github.com/stdlib-js/stdlib/graphs/contributors

[stdlib-license]: https://raw.githubusercontent.com/stdlib-js/assign-issue-on-label-action/master/LICENSE

</section>

<!-- /.links -->