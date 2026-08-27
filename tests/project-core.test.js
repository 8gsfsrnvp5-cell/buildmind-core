'use strict';

const assert =
  require('node:assert/strict');
const fs =
  require('node:fs');
const path =
  require('node:path');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const index =
  fs.readFileSync(
    path.join(root, 'index.html'),
    'utf8'
  );

const projectCore =
  fs.readFileSync(
    path.join(root, 'projectCore.js'),
    'utf8'
  );

assert.equal(
  index.includes('id="projectCoreSection"'),
  true,
  'Project window is missing'
);

assert.equal(
  index.includes('id="projectCoreArchiveMessage"'),
  true,
  'Project archive message is missing'
);

[
  'archivedProjects',
  'archiveProjectCoreNode',
  'project-core-delete-node',
  'getArchivedNodes',
  'window.confirm'
].forEach(function (marker) {
  assert.equal(
    projectCore.includes(marker),
    true,
    'Project deletion marker is missing: ' +
      marker
  );
});

assert.equal(
  index.includes('projectCore.js?v=2'),
  true,
  'Project Core cache version is not bumped'
);

console.log(
  'BuildMind project core test: PASS'
);
