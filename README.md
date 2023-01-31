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

# Create Bundle

> GitHub action to create bundles for a stdlib package.

---

## Example Workflow

```yml
# Workflow name:
name: bundle

# Workflow triggers:
on:
  workflow_dispatch:

# Workflow jobs:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
        with:
          repository: 'stdlib-js/assert-is-nan'
      - uses: actions/setup-node@v3
        with:
          node-version: 16
        timeout-minutes: 5
      - name: Install production and development dependencies
        id: install
        run: |
          npm install || npm install || npm install
      - name: Bundle `@stdlib/assert-is-nan`
        uses: stdlib-js/bundle-action@main
        with:
          target: "deno"
```

## Inputs

-   `target`: Bundle target (`deno`, `umd-node`, `umd-browser`, or `esm`).
-   `pkg`: (optional) a string containing the name of the npm package to bundle. Defaults to the package in the current repository.
-   `alias`: (optional) a string containing an alias for the package in the global scope for the `umd` bundles. Defaults to the package name.
-   `minify`: (optional) a boolean indicating whether to minify the bundle. Defaults to `true`.

## License

See [LICENSE][stdlib-license].


## Copyright

Copyright &copy; 2022-2023. The Stdlib [Authors][stdlib-authors].

<!-- Section for all links. Make sure to keep an empty line after the `section` element and another before the `/section` close. -->

<section class="links">

[stdlib]: https://github.com/stdlib-js/stdlib

[stdlib-authors]: https://github.com/stdlib-js/stdlib/graphs/contributors

[stdlib-license]: https://raw.githubusercontent.com/stdlib-js/assign-issue-on-label-action/master/LICENSE

</section>

<!-- /.links -->
