'use strict';

const assert =
  require('node:assert/strict');
const fs =
  require('node:fs');
const path =
  require('node:path');

function run() {
  const fixturePath =
    path.join(
      __dirname,
      'fixtures',
      'composite-pdf-road-41p.gold.json'
    );

  const fixture =
    JSON.parse(
      fs.readFileSync(
        fixturePath,
        'utf8'
      )
    );

  assert.equal(
    fixture.sourcePolicy,
    'private-local-only'
  );
  assert.equal(
    fixture.totalPages,
    41
  );

  const coveredPages = [];

  fixture.expectedSections
    .forEach(function (section) {
      assert.ok(
        section.startPage >= 1
      );
      assert.ok(
        section.endPage >=
          section.startPage
      );

      for (
        let page =
          section.startPage;
        page <= section.endPage;
        page += 1
      ) {
        coveredPages.push(page);
      }
    });

  assert.deepEqual(
    coveredPages,
    Array.from(
      {
        length:
          fixture.totalPages
      },
      function (_, index) {
        return index + 1;
      }
    )
  );

  assert.deepEqual(
    fixture.expectedSections.map(
      function (section) {
        return [
          section.kind,
          section.startPage,
          section.endPage
        ];
      }
    ),
    [
      ['agreement', 1, 32],
      ['schedule', 33, 38],
      ['commercial-proposal', 39, 41]
    ]
  );

  assert.ok(
    fixture.pageExpectations.some(
      function (item) {
        return (
          item.pageNumber === 31 &&
          item.expectedKind ===
            'agreement' &&
          item.forbiddenAnchorKinds
            .includes('schedule')
        );
      }
    )
  );

  console.log(
    'BuildMind 41-page gold fixture test: PASS'
  );
}

run();
