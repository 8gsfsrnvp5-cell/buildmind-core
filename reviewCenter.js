'use strict';

/* ==================================================
   BUILDMIND REVIEW CENTER — V1

   Единая очередь инженерной проверки и каноническая
   подтверждённая модель проекта. Автоматический вывод
   становится фактом проекта только после решения
   ответственного специалиста.
   ================================================== */

const BUILDMIND_REVIEW_CENTER_VERSION =
  'review-center-v1';

const REVIEW_CENTER_STORAGE_KEY =
  'buildmind-review-center-v1';

const REVIEW_CENTER_LIMIT = 500;

const REVIEW_DECISION_LIMIT = 1500;


const REVIEW_STATUS_LABELS = {
  pending: 'Ожидает решения',
  confirmed: 'Подтверждено',
  rejected: 'Отклонено',
  clarification: 'Нужно уточнить'
};


const REVIEW_ENTITY_LABELS = {
  document: 'Документ',
  work: 'Работа',
  material: 'Материал',
  schedule: 'Сроки ГПР',
  'change-set': 'Пакет изменений'
};


function reviewCenterNow() {
  return new Date().toISOString();
}


function reviewCenterId(prefix = 'review') {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      'function'
  ) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return (
    `${prefix}-${Date.now()}-` +
    Math.random().toString(16).slice(2)
  );
}


function cloneReviewCenterValue(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}


function emptyConfirmedProjectModel() {
  return {
    version: 'confirmed-project-model-v1',
    project: null,
    documents: [],
    works: [],
    materials: [],
    appliedChangeSetIds: [],
    revision: 0,
    createdAt: '',
    updatedAt: ''
  };
}


function emptyReviewCenterState() {
  return {
    version: BUILDMIND_REVIEW_CENTER_VERSION,
    queue: [],
    decisions: [],
    model: emptyConfirmedProjectModel(),
    createdAt: '',
    updatedAt: ''
  };
}


function normalizeReviewStatus(value) {
  return Object.prototype.hasOwnProperty.call(
    REVIEW_STATUS_LABELS,
    value
  )
    ? value
    : 'pending';
}


function normalizeReviewConfidence(value) {
  if (value === 'high') {
    return 0.92;
  }

  if (value === 'medium') {
    return 0.72;
  }

  if (value === 'low') {
    return 0.45;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0.65;
  }

  return Math.min(
    1,
    Math.max(
      0,
      number > 1
        ? number / 100
        : number
    )
  );
}


function loadReviewCenterState() {
  try {
    const saved =
      localStorage.getItem(
        REVIEW_CENTER_STORAGE_KEY
      );

    if (!saved) {
      return emptyReviewCenterState();
    }

    const parsed = JSON.parse(saved);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return emptyReviewCenterState();
    }

    return {
      ...emptyReviewCenterState(),
      ...parsed,
      version: BUILDMIND_REVIEW_CENTER_VERSION,
      queue:
        Array.isArray(parsed.queue)
          ? parsed.queue.map(
              function (item) {
                return {
                  ...item,
                  status:
                    normalizeReviewStatus(
                      item.status
                    )
                };
              }
            )
          : [],
      decisions:
        Array.isArray(parsed.decisions)
          ? parsed.decisions
          : [],
      model: {
        ...emptyConfirmedProjectModel(),
        ...(parsed.model || {}),
        documents:
          Array.isArray(parsed.model?.documents)
            ? parsed.model.documents
            : [],
        works:
          Array.isArray(parsed.model?.works)
            ? parsed.model.works
            : [],
        materials:
          Array.isArray(parsed.model?.materials)
            ? parsed.model.materials
            : [],
        appliedChangeSetIds:
          Array.isArray(
            parsed.model?.appliedChangeSetIds
          )
            ? parsed.model.appliedChangeSetIds
            : []
      }
    };
  } catch (error) {
    console.warn(
      'Review Center: не удалось прочитать состояние:',
      error
    );

    return emptyReviewCenterState();
  }
}


let reviewCenterState =
  loadReviewCenterState();

let activeReviewFilter = 'all';


function saveReviewCenterState() {
  const now = reviewCenterNow();

  if (!reviewCenterState.createdAt) {
    reviewCenterState.createdAt = now;
  }

  reviewCenterState.updatedAt = now;
  reviewCenterState.queue =
    reviewCenterState.queue.slice(
      0,
      REVIEW_CENTER_LIMIT
    );
  reviewCenterState.decisions =
    reviewCenterState.decisions.slice(
      -REVIEW_DECISION_LIMIT
    );

  localStorage.setItem(
    REVIEW_CENTER_STORAGE_KEY,
    JSON.stringify(reviewCenterState)
  );

  window.dispatchEvent(
    new CustomEvent(
      'buildmind:review-center-changed',
      {
        detail:
          cloneReviewCenterValue(
            reviewCenterState
          )
      }
    )
  );
}


function escapeReviewCenterHtml(value) {
  const symbols = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return String(value ?? '').replace(
    /[&<>"']/g,
    function (symbol) {
      return symbols[symbol];
    }
  );
}


function normalizeReviewKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function reviewSourceKey(item) {
  return [
    item.sourceType || 'manual',
    item.sourceId || '',
    item.entityType || '',
    item.itemKey || normalizeReviewKey(item.title)
  ].join(':');
}


function queueReviewItem(input) {
  const now = reviewCenterNow();
  const normalized = {
    id: input.id || reviewCenterId(),
    sourceType: input.sourceType || 'manual',
    sourceId: input.sourceId || '',
    entityType:
      REVIEW_ENTITY_LABELS[input.entityType]
        ? input.entityType
        : 'document',
    itemKey:
      input.itemKey ||
      normalizeReviewKey(input.title),
    title: String(input.title || 'Без названия'),
    description: String(input.description || ''),
    sourceLabel: String(input.sourceLabel || 'BuildMind'),
    confidence:
      normalizeReviewConfidence(input.confidence),
    status:
      normalizeReviewStatus(input.status),
    payload:
      cloneReviewCenterValue(
        input.payload || {}
      ),
    recommendedAction:
      String(
        input.recommendedAction ||
        'Проверить исходный документ и подтвердить или отклонить.'
      ),
    decisionComment:
      String(input.decisionComment || ''),
    decidedAt: input.decidedAt || null,
    decidedByRole: input.decidedByRole || '',
    appliedAt: input.appliedAt || null,
    createdAt: input.createdAt || now,
    updatedAt: now,
    requiresEngineerConfirmation: true
  };

  const key = reviewSourceKey(normalized);
  const existing =
    reviewCenterState.queue.find(
      function (item) {
        return reviewSourceKey(item) === key;
      }
    );

  if (existing) {
    const priorStatus = existing.status;
    const priorDecision = existing.decisionComment;
    const priorDecidedAt = existing.decidedAt;
    const priorAppliedAt = existing.appliedAt;

    Object.assign(existing, normalized, {
      id: existing.id,
      createdAt: existing.createdAt,
      status:
        normalized.status !== 'pending'
          ? normalized.status
          : priorStatus,
      decisionComment:
        priorDecision || normalized.decisionComment,
      decidedAt:
        priorDecidedAt || normalized.decidedAt,
      appliedAt:
        priorAppliedAt || normalized.appliedAt
    });

    return existing;
  }

  reviewCenterState.queue.unshift(normalized);
  return normalized;
}


function reviewItemTitle(item) {
  return (
    item.workName ||
    item.name ||
    item.fileName ||
    item.organization ||
    'Вывод автоматического анализа'
  );
}


function reviewItemDescription(item) {
  if (item.reviewType === 'schedule-anomaly') {
    return (
      `Проверить сроки: ${item.startDate || '—'} → ` +
      `${item.finishDate || '—'}. ` +
      (Array.isArray(item.reasons)
        ? item.reasons.join('; ')
        : '')
    ).trim();
  }

  if (item.reviewType === 'document-kind') {
    return (
      `Классификация: ${item.kind || 'не определена'}. ` +
      `Уверенность: ${item.confidence || 'не указана'}.`
    );
  }

  if (item.reviewType === 'approval') {
    return (
      item.context ||
      item.intent ||
      'Найдено упоминание согласования или утверждения.'
    );
  }

  return (
    item.context ||
    item.description ||
    'Строка или факт требуют инженерной классификации.'
  );
}


function inferReviewEntity(item) {
  if (item.reviewType === 'schedule-anomaly') {
    return 'schedule';
  }

  if (
    item.workName ||
    item.rowType === 'work'
  ) {
    return 'work';
  }

  if (
    item.materialName ||
    item.rowType === 'material'
  ) {
    return 'material';
  }

  return 'document';
}


function syncProjectIntakeReviewItems() {
  const result =
    window.BuildMindProjectIntake &&
    typeof window.BuildMindProjectIntake
      .getLastResult === 'function'
      ? window.BuildMindProjectIntake.getLastResult()
      : null;

  if (!result?.success) {
    return 0;
  }

  let added = 0;

  (result.documents || [])
    .filter(function (item) {
      return item.requiresReview;
    })
    .forEach(function (item) {
      queueReviewItem({
        sourceType: 'project-intake',
        sourceId: item.documentId,
        entityType: 'document',
        itemKey: `document:${item.documentId}`,
        title: item.fileName,
        description:
          `Проверить тип документа: ${item.kind || 'не определён'}.`,
        sourceLabel: 'Первичный анализ комплекта',
        confidence: item.confidence,
        payload: item
      });
      added += 1;
    });

  (result.reviewItems || [])
    .forEach(function (item, index) {
      const entityType = inferReviewEntity(item);
      const sourceId =
        [
          item.fileName,
          item.sourceSheet,
          item.sourceRow,
          item.reviewType,
          index
        ]
          .filter(
            function (value) {
              return value !== undefined &&
                value !== null &&
                value !== '';
            }
          )
          .join(':');

      queueReviewItem({
        sourceType: 'project-intake',
        sourceId,
        entityType,
        title: reviewItemTitle(item),
        description: reviewItemDescription(item),
        sourceLabel:
          item.fileName ||
          'Первичный анализ комплекта',
        confidence: item.confidence,
        payload: item
      });
      added += 1;
    });

  return added;
}


function candidateSourceId(
  documentItem,
  candidate,
  index
) {
  return [
    documentItem.id || documentItem.file?.name,
    candidate.id,
    candidate.sourceSheet,
    candidate.sourceRow || candidate.pageNumber,
    candidate.workName || candidate.name,
    index
  ]
    .filter(
      function (value) {
        return value !== undefined &&
          value !== null &&
          value !== '';
      }
    )
    .join(':');
}


function syncDocumentCandidates() {
  const documents =
    window.BuildMindProjectDocuments &&
    typeof window.BuildMindProjectDocuments
      .getAll === 'function'
      ? window.BuildMindProjectDocuments.getAll()
      : [];

  let added = 0;

  documents.forEach(function (documentItem) {
    const sourceLabel =
      documentItem.file?.name ||
      'Загруженный документ';

    const workCandidates =
      Array.isArray(
        documentItem.workVolumeAnalysis?.candidates
      )
        ? documentItem.workVolumeAnalysis.candidates
        : [];

    workCandidates
      .filter(function (candidate) {
        return [
          'work',
          'material',
          'uncertain'
        ].includes(candidate.rowType);
      })
      .slice(0, 250)
      .forEach(function (candidate, index) {
        const entityType =
          candidate.rowType === 'material'
            ? 'material'
            : candidate.rowType === 'work'
              ? 'work'
              : 'document';

        const queueItem = queueReviewItem({
          sourceType: 'document-candidate',
          sourceId:
            candidateSourceId(
              documentItem,
              candidate,
              index
            ),
          entityType,
          title:
            candidate.workName ||
            candidate.name ||
            'Нераспознанная строка',
          description:
            candidate.quantity !== undefined
              ? `${candidate.quantity} ${candidate.unit || ''}`.trim()
              : 'Проверить назначение строки.',
          sourceLabel,
          confidence:
            candidate.confidenceScore ||
            candidate.confidence,
          status:
            candidate.decisionStatus === 'confirmed'
              ? 'confirmed'
              : candidate.decisionStatus === 'rejected'
                ? 'rejected'
                : 'pending',
          payload: candidate
        });

        if (
          queueItem.status === 'confirmed' &&
          !queueItem.appliedAt
        ) {
          applyConfirmedReviewItem(
            queueItem,
            'Решение синхронизировано из анализа таблицы.'
          );
        }

        added += 1;
      });

    const materialCandidates =
      Array.isArray(
        documentItem.analysis?.materialCandidates
      )
        ? documentItem.analysis.materialCandidates
        : [];

    materialCandidates
      .slice(0, 250)
      .forEach(function (candidate, index) {
        const queueItem = queueReviewItem({
          sourceType: 'material-candidate',
          sourceId:
            candidateSourceId(
              documentItem,
              candidate,
              index
            ),
          entityType: 'material',
          title:
            candidate.name ||
            'Материал без названия',
          description:
            `${candidate.quantity || '—'} ${candidate.unit || ''}`.trim(),
          sourceLabel,
          confidence:
            candidate.confidenceScore ||
            candidate.confidence,
          status:
            candidate.reviewStatus === 'confirmed'
              ? 'confirmed'
              : candidate.reviewStatus === 'rejected'
                ? 'rejected'
                : 'pending',
          payload: candidate
        });

        if (
          queueItem.status === 'confirmed' &&
          !queueItem.appliedAt
        ) {
          applyConfirmedReviewItem(
            queueItem,
            'Решение синхронизировано из проверки материала.'
          );
        }

        added += 1;
      });
  });

  return added;
}


function syncChangeSetReviewItems() {
  const changeSets =
    window.BuildMindChangeSet &&
    typeof window.BuildMindChangeSet.getAll ===
      'function'
      ? window.BuildMindChangeSet.getAll()
      : [];

  changeSets.forEach(function (changeSet) {
    const mappedStatus =
      changeSet.status === 'confirmed'
        ? 'confirmed'
        : changeSet.status === 'needs-review' ||
          changeSet.status === 'needs-baseline'
          ? 'clarification'
          : 'pending';

    const queueItem = queueReviewItem({
      sourceType: 'change-set',
      sourceId: changeSet.id,
      entityType: 'change-set',
      itemKey: changeSet.id,
      title: changeSet.logicalTitle,
      description:
        `${changeSet.previousRevisionLabel} → ` +
        `${changeSet.newRevisionLabel}: ` +
        `${changeSet.summary?.total || 0} изменений.`,
      sourceLabel: 'Сравнение редакций',
      confidence:
        changeSet.warnings?.length > 0
          ? 0.7
          : 0.9,
      status: mappedStatus,
      decisionComment:
        changeSet.decisionComment || '',
      decidedAt:
        changeSet.decidedAt || null,
      payload: changeSet,
      recommendedAction:
        'Сверить изменения с основанием и применить только подтверждённый пакет.'
    });

    if (
      queueItem.status === 'confirmed' &&
      !queueItem.appliedAt
    ) {
      applyConfirmedReviewItem(
        queueItem,
        'Решение синхронизировано из пакета изменений.'
      );
    }
  });

  return changeSets.length;
}


function syncReviewCenterSources() {
  const sourceCount =
    syncProjectIntakeReviewItems() +
    syncDocumentCandidates() +
    syncChangeSetReviewItems();

  saveReviewCenterState();
  renderReviewCenter();

  setReviewCenterMessage(
    sourceCount > 0
      ? `Очередь обновлена. Обработано источников: ${sourceCount}.`
      : 'Новых выводов пока нет. Загрузите документы или запустите сквозной пример.'
  );

  return sourceCount;
}


function getProjectIdentity() {
  const root =
    window.BuildMindProjectCore &&
    typeof window.BuildMindProjectCore.getRoot ===
      'function'
      ? window.BuildMindProjectCore.getRoot()
      : null;

  return root || {
    id: '',
    name:
      document.getElementById('projectName')?.value ||
      'Проект не указан',
    object:
      document.getElementById('objectName')?.value ||
      'Объект не указан',
    code: '',
    contractNumber: ''
  };
}


function ensureConfirmedModelIdentity() {
  const model = reviewCenterState.model;
  const identity = getProjectIdentity();
  const now = reviewCenterNow();

  model.project = {
    ...(model.project || {}),
    ...identity,
    startDate:
      document.getElementById('projectStartDate')?.value ||
      model.project?.startDate ||
      '',
    finishDate:
      document.getElementById('projectEndDate')?.value ||
      model.project?.finishDate ||
      '',
    confirmedAt:
      model.project?.confirmedAt || now,
    updatedAt: now
  };

  if (!model.createdAt) {
    model.createdAt = now;
  }
}


function modelEntityKey(entity) {
  return normalizeReviewKey(
    entity.workName ||
    entity.materialName ||
    entity.name ||
    entity.title
  );
}


function upsertConfirmedEntity(
  collection,
  entity,
  sourceItem
) {
  const now = reviewCenterNow();
  const key = modelEntityKey(entity);
  const existing = collection.find(
    function (item) {
      return modelEntityKey(item) === key;
    }
  );

  const normalized = {
    ...entity,
    id:
      existing?.id ||
      entity.id ||
      reviewCenterId(sourceItem.entityType),
    name:
      entity.name ||
      entity.workName ||
      entity.materialName ||
      sourceItem.title,
    status: entity.status || 'active',
    sourceReviewItemId: sourceItem.id,
    sourceLabel: sourceItem.sourceLabel,
    confidence: sourceItem.confidence,
    revision:
      existing
        ? Number(existing.revision || 1) + 1
        : 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  if (existing) {
    Object.assign(existing, normalized);
    return existing;
  }

  collection.push(normalized);
  return normalized;
}


function excludeConfirmedEntity(
  collection,
  entity,
  sourceItem
) {
  const key = modelEntityKey(entity);
  let existing = collection.find(
    function (item) {
      return modelEntityKey(item) === key;
    }
  );

  if (!existing) {
    existing = upsertConfirmedEntity(
      collection,
      entity,
      sourceItem
    );
  }

  existing.status = 'excluded';
  existing.excludedAt = reviewCenterNow();
  existing.updatedAt = existing.excludedAt;
  existing.revision =
    Number(existing.revision || 1) + 1;
}


function applyChangeSetToModel(
  changeSet,
  sourceItem
) {
  const model = reviewCenterState.model;

  if (
    model.appliedChangeSetIds.includes(
      changeSet.id
    )
  ) {
    return;
  }

  (changeSet.changes || []).forEach(
    function (change) {
      const collection =
        change.entityType === 'material'
          ? model.materials
          : model.works;

      if (change.changeType === 'removed') {
        excludeConfirmedEntity(
          collection,
          change.before || {name: change.label},
          sourceItem
        );
        return;
      }

      upsertConfirmedEntity(
        collection,
        change.after || {name: change.label},
        sourceItem
      );
    }
  );

  model.appliedChangeSetIds.push(changeSet.id);
}


function applyConfirmedReviewItem(
  item,
  comment
) {
  ensureConfirmedModelIdentity();

  const model = reviewCenterState.model;
  const payload = item.payload || {};

  if (item.entityType === 'document') {
    upsertConfirmedEntity(
      model.documents,
      {
        ...payload,
        name:
          payload.fileName ||
          payload.name ||
          item.title,
        kind:
          payload.kind ||
          payload.reviewType ||
          'other'
      },
      item
    );
  }

  if (item.entityType === 'work') {
    upsertConfirmedEntity(
      model.works,
      {
        ...payload,
        name:
          payload.workName ||
          payload.name ||
          item.title
      },
      item
    );
  }

  if (item.entityType === 'material') {
    upsertConfirmedEntity(
      model.materials,
      {
        ...payload,
        name:
          payload.materialName ||
          payload.name ||
          item.title
      },
      item
    );
  }

  if (item.entityType === 'schedule') {
    upsertConfirmedEntity(
      model.works,
      {
        ...payload,
        name:
          payload.workName ||
          item.title,
        startDate: payload.startDate || '',
        finishDate: payload.finishDate || ''
      },
      item
    );
  }

  if (item.entityType === 'change-set') {
    applyChangeSetToModel(payload, item);
  }

  const now = reviewCenterNow();
  item.appliedAt = now;
  model.revision = Number(model.revision || 0) + 1;
  model.updatedAt = now;

  reviewCenterState.decisions.push({
    id: reviewCenterId('decision'),
    reviewItemId: item.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    entityType: item.entityType,
    title: item.title,
    decision: 'confirmed',
    comment: String(comment || ''),
    actorRole: 'engineer',
    occurredAt: now,
    modelRevision: model.revision
  });
}


function recordNonConfirmDecision(
  item,
  decision,
  comment
) {
  reviewCenterState.decisions.push({
    id: reviewCenterId('decision'),
    reviewItemId: item.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    entityType: item.entityType,
    title: item.title,
    decision,
    comment: String(comment || ''),
    actorRole: 'engineer',
    occurredAt: reviewCenterNow(),
    modelRevision:
      Number(reviewCenterState.model.revision || 0)
  });
}


function decideReviewItem(
  itemId,
  decision,
  comment = ''
) {
  const item = reviewCenterState.queue.find(
    function (queueItem) {
      return queueItem.id === itemId;
    }
  );

  if (!item) {
    return false;
  }

  const allowed = [
    'confirmed',
    'rejected',
    'clarification'
  ];

  if (!allowed.includes(decision)) {
    return false;
  }

  const now = reviewCenterNow();

  item.status = decision;
  item.decisionComment = String(comment || '').trim();
  item.decidedAt = now;
  item.decidedByRole = 'engineer';
  item.updatedAt = now;

  if (decision === 'confirmed' && !item.appliedAt) {
    applyConfirmedReviewItem(
      item,
      item.decisionComment
    );
  } else if (decision !== 'confirmed') {
    recordNonConfirmDecision(
      item,
      decision,
      item.decisionComment
    );
  }

  if (
    item.sourceType === 'change-set' &&
    window.BuildMindChangeSet &&
    typeof window.BuildMindChangeSet.setDecision ===
      'function'
  ) {
    window.BuildMindChangeSet.setDecision(
      item.sourceId,
      decision === 'confirmed'
        ? 'confirmed'
        : 'needs-review',
      item.decisionComment ||
        (decision === 'confirmed'
          ? 'Пакет применён к подтверждённой модели проекта.'
          : 'Пакет возвращён на уточнение из Review Center.')
    );
  }

  saveReviewCenterState();
  renderReviewCenter();

  return true;
}


function confirmPendingReviewItems() {
  const pending = reviewCenterState.queue.filter(
    function (item) {
      return [
        'pending',
        'clarification'
      ].includes(item.status);
    }
  ).sort(
    function (left, right) {
      return (
        Number(left.entityType === 'change-set') -
        Number(right.entityType === 'change-set')
      );
    }
  );

  pending.forEach(function (item) {
    decideReviewItem(
      item.id,
      'confirmed',
      'Подтверждено инженером пакетно.'
    );
  });

  return pending.length;
}


function seedDemoProjectIdentity() {
  const demoProject = {
    name:
      'Капитальный ремонт автомобильной дороги М-7',
    object:
      'Участок км 125+000 — км 127+000',
    code: 'BM-ROAD-2026-01',
    contractNumber: 'ДОГ-2026/041',
    startDate: '2026-09-01',
    finishDate: '2026-11-15'
  };

  const fields = {
    projectName: demoProject.name,
    objectName: demoProject.object,
    projectStartDate: demoProject.startDate,
    projectEndDate: demoProject.finishDate,
    projectCoreCode: demoProject.code,
    projectCoreContract: demoProject.contractNumber
  };

  Object.entries(fields).forEach(
    function ([id, value]) {
      const element = document.getElementById(id);

      if (element && !element.value) {
        element.value = value;
      }
    }
  );

  const existingProject =
    window.BuildMindProjectCore &&
    typeof window.BuildMindProjectCore.getRoot ===
      'function'
      ? window.BuildMindProjectCore.getRoot()
      : null;

  if (
    !existingProject &&
    window.BuildMindProjectCore &&
    typeof window.BuildMindProjectCore.upsertRoot ===
      'function'
  ) {
    window.BuildMindProjectCore.upsertRoot(demoProject);
  }

  return existingProject || demoProject;
}


function createReviewCenterDemo() {
  const project = seedDemoProjectIdentity();

  const demoItems = [
    {
      id: 'review-demo-document-vor',
      entityType: 'document',
      title: 'ВОР_дорога_R1.xlsx',
      description:
        'Ведомость объёмов работ, редакция R1. Определено автоматически.',
      confidence: 0.97,
      payload: {
        fileName: 'ВОР_дорога_R1.xlsx',
        kind: 'work-volume',
        revision: 'R1'
      }
    },
    {
      id: 'review-demo-document-gpr',
      entityType: 'document',
      title: 'ГПР_дорога_R1.xlsx',
      description:
        'График производства работ, редакция R1.',
      confidence: 0.95,
      payload: {
        fileName: 'ГПР_дорога_R1.xlsx',
        kind: 'schedule',
        revision: 'R1'
      }
    },
    {
      id: 'review-demo-work-milling',
      entityType: 'work',
      title: 'Фрезерование асфальтобетонного покрытия',
      description: '20 000 м² · ВОР, лист 2, строка 18',
      confidence: 0.94,
      payload: {
        workName: 'Фрезерование асфальтобетонного покрытия',
        quantity: 20000,
        unit: 'м²',
        startDate: '2026-09-05',
        finishDate: '2026-09-12'
      }
    },
    {
      id: 'review-demo-work-asphalt',
      entityType: 'work',
      title: 'Устройство верхнего слоя ЩМА-16',
      description: '20 000 м² · ВОР, лист 2, строка 31',
      confidence: 0.91,
      payload: {
        workName: 'Устройство верхнего слоя ЩМА-16',
        quantity: 20000,
        unit: 'м²',
        startDate: '2026-09-20',
        finishDate: '2026-10-08'
      }
    },
    {
      id: 'review-demo-work-curb',
      entityType: 'work',
      title: 'Установка бортового камня',
      description: '1 200 м · ВОР, лист 3, строка 8',
      confidence: 0.89,
      payload: {
        workName: 'Установка бортового камня',
        quantity: 1200,
        unit: 'м',
        startDate: '2026-09-14',
        finishDate: '2026-09-28'
      }
    },
    {
      id: 'review-demo-material-asphalt',
      entityType: 'material',
      title: 'ЩМА-16',
      description: 'Потребность 2 480 т по подтверждаемому объёму.',
      confidence: 0.9,
      payload: {
        materialName: 'ЩМА-16',
        quantity: 2480,
        unit: 'т',
        needDate: '2026-09-17'
      }
    },
    {
      id: 'review-demo-material-emulsion',
      entityType: 'material',
      title: 'Битумная эмульсия',
      description:
        'Сопутствующий материал не указан отдельной строкой. Рекомендовано 12 т.',
      confidence: 0.78,
      payload: {
        materialName: 'Битумная эмульсия',
        quantity: 12,
        unit: 'т',
        needDate: '2026-09-18',
        suggestionReason:
          'Технологическая связка с устройством асфальтобетонного слоя.'
      },
      recommendedAction:
        'Проверить норму розлива по проекту и подтвердить количество.'
    },
    {
      id: 'review-demo-material-curb',
      entityType: 'material',
      title: 'Бортовой камень БР 100.30.15',
      description: 'Потребность 1 224 шт. с технологическим запасом 2%.',
      confidence: 0.86,
      payload: {
        materialName: 'Бортовой камень БР 100.30.15',
        quantity: 1224,
        unit: 'шт',
        needDate: '2026-09-10'
      }
    },
    {
      id: 'review-demo-schedule',
      entityType: 'schedule',
      title: 'Устройство верхнего слоя ЩМА-16',
      description:
        'ГПР: 20.09.2026 → 08.10.2026. Заказ материала нужен до начала работ.',
      confidence: 0.88,
      payload: {
        workName: 'Устройство верхнего слоя ЩМА-16',
        startDate: '2026-09-20',
        finishDate: '2026-10-08',
        durationDays: 19
      }
    }
  ];

  demoItems.forEach(function (item) {
    queueReviewItem({
      ...item,
      sourceType: 'demo-road-project',
      sourceId: item.id,
      itemKey: item.id,
      sourceLabel: 'Сквозной пример дорожного проекта'
    });
  });

  if (
    window.BuildMindChangeSet &&
    typeof window.BuildMindChangeSet.createDemo ===
      'function'
  ) {
    window.BuildMindChangeSet.createDemo();
    syncChangeSetReviewItems();
  }

  ensureConfirmedModelIdentity();
  reviewCenterState.model.project = {
    ...(reviewCenterState.model.project || {}),
    ...project,
    status: 'draft-until-confirmed'
  };

  saveReviewCenterState();
  renderReviewCenter();

  setReviewCenterMessage(
    'Сквозной пример создан: документы → работы и материалы → изменения → решение инженера → модель проекта.'
  );

  if (
    window.BuildMindWorkspace &&
    typeof window.BuildMindWorkspace.open === 'function'
  ) {
    window.BuildMindWorkspace.open('review');
  }

  return cloneReviewCenterValue(reviewCenterState);
}


function setReviewCenterMessage(text) {
  const element =
    document.getElementById('reviewCenterMessage');

  if (element) {
    element.textContent = text || '';
  }
}


function formatReviewDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  ).format(date);
}


function formatReviewNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: 3
      }).format(number)
    : '—';
}


function reviewPayloadSummary(item) {
  const payload = item.payload || {};
  const parts = [];

  if (payload.quantity !== undefined) {
    parts.push(
      `${formatReviewNumber(payload.quantity)} ${payload.unit || ''}`.trim()
    );
  }

  if (payload.startDate || payload.finishDate) {
    parts.push(
      `${payload.startDate || '—'} → ${payload.finishDate || '—'}`
    );
  }

  if (item.entityType === 'change-set') {
    parts.push(
      `${payload.summary?.added || 0} добавлено · ` +
      `${payload.summary?.modified || 0} изменено · ` +
      `${payload.summary?.removed || 0} исключено`
    );
  }

  return parts.join(' · ');
}


function renderReviewQueueItem(item) {
  const confidence = Math.round(item.confidence * 100);
  const payloadSummary = reviewPayloadSummary(item);
  const actions =
    item.status === 'confirmed' ||
    item.status === 'rejected'
      ? ''
      : `
        <div class="review-center-item-actions">
          <button
            type="button"
            class="primary"
            data-review-action="confirm"
            data-review-id="${escapeReviewCenterHtml(item.id)}"
          >
            Подтвердить
          </button>
          <button
            type="button"
            class="secondary"
            data-review-action="clarify"
            data-review-id="${escapeReviewCenterHtml(item.id)}"
          >
            Уточнить
          </button>
          <button
            type="button"
            class="review-center-reject"
            data-review-action="reject"
            data-review-id="${escapeReviewCenterHtml(item.id)}"
          >
            Отклонить
          </button>
        </div>
      `;

  return `
    <article class="review-center-item review-center-item-${escapeReviewCenterHtml(item.status)}">
      <div class="review-center-item-head">
        <div>
          <span class="review-center-entity">
            ${escapeReviewCenterHtml(
              REVIEW_ENTITY_LABELS[item.entityType] ||
              item.entityType
            )}
          </span>
          <h3>${escapeReviewCenterHtml(item.title)}</h3>
        </div>
        <span class="review-center-status review-center-status-${escapeReviewCenterHtml(item.status)}">
          ${escapeReviewCenterHtml(
            REVIEW_STATUS_LABELS[item.status] ||
            item.status
          )}
        </span>
      </div>

      <p>${escapeReviewCenterHtml(item.description)}</p>

      ${payloadSummary
        ? `<div class="review-center-payload">${escapeReviewCenterHtml(payloadSummary)}</div>`
        : ''}

      <div class="review-center-item-meta">
        <span>Источник: ${escapeReviewCenterHtml(item.sourceLabel)}</span>
        <span>Уверенность: <strong>${confidence}%</strong></span>
      </div>

      <p class="review-center-recommendation">
        ${escapeReviewCenterHtml(item.recommendedAction)}
      </p>

      ${item.decisionComment
        ? `
          <p class="review-center-decision-comment">
            <strong>Решение инженера:</strong>
            ${escapeReviewCenterHtml(item.decisionComment)}
          </p>
        `
        : ''}

      ${actions}
    </article>
  `;
}


function renderModelEntityList(
  entities,
  emptyText
) {
  const active = entities.filter(
    function (item) {
      return item.status !== 'excluded';
    }
  );

  if (active.length === 0) {
    return `<p class="review-model-empty">${escapeReviewCenterHtml(emptyText)}</p>`;
  }

  return `
    <ul class="review-model-list">
      ${active.slice(0, 6).map(
        function (item) {
          return `
            <li>
              <strong>${escapeReviewCenterHtml(item.name)}</strong>
              <span>
                ${item.quantity !== undefined
                  ? escapeReviewCenterHtml(
                      `${formatReviewNumber(item.quantity)} ${item.unit || ''}`.trim()
                    )
                  : escapeReviewCenterHtml(item.kind || 'Подтверждено')}
              </span>
            </li>
          `;
        }
      ).join('')}
    </ul>
    ${active.length > 6
      ? `<p class="review-model-more">Ещё ${active.length - 6}</p>`
      : ''}
  `;
}


function renderConfirmedModel() {
  const model = reviewCenterState.model;
  const host = document.getElementById('confirmedModelPanel');

  if (!host) {
    return;
  }

  const activeWorks = model.works.filter(
    function (item) {
      return item.status !== 'excluded';
    }
  );
  const activeMaterials = model.materials.filter(
    function (item) {
      return item.status !== 'excluded';
    }
  );

  host.innerHTML = `
    <div class="review-model-head">
      <div>
        <span class="review-center-eyebrow">CONFIRMED MODEL</span>
        <h2>Подтверждённая модель проекта</h2>
      </div>
      <span class="review-model-revision">Редакция ${Number(model.revision || 0)}</span>
    </div>

    <div class="review-model-project">
      <strong>${escapeReviewCenterHtml(
        model.project?.name ||
        'Модель ещё не сформирована'
      )}</strong>
      <span>${escapeReviewCenterHtml(
        model.project?.object ||
        'Подтвердите выводы инженерного анализа.'
      )}</span>
    </div>

    <div class="review-model-stats">
      <div><strong>${model.documents.length}</strong><span>Документов</span></div>
      <div><strong>${activeWorks.length}</strong><span>Работ</span></div>
      <div><strong>${activeMaterials.length}</strong><span>Материалов</span></div>
    </div>

    <section class="review-model-group">
      <h3>Подтверждённые работы</h3>
      ${renderModelEntityList(
        model.works,
        'Работы появятся после подтверждения.'
      )}
    </section>

    <section class="review-model-group">
      <h3>Подтверждённые материалы</h3>
      ${renderModelEntityList(
        model.materials,
        'Материалы появятся после подтверждения.'
      )}
    </section>

    <p class="review-model-updated">
      Последнее обновление: ${escapeReviewCenterHtml(
        formatReviewDate(model.updatedAt)
      )}
    </p>
  `;
}


function renderReviewDecisionHistory() {
  const host = document.getElementById('reviewDecisionHistory');

  if (!host) {
    return;
  }

  const decisions = reviewCenterState.decisions
    .slice(-8)
    .reverse();

  host.innerHTML = decisions.length
    ? decisions.map(function (decision) {
        return `
          <li>
            <span class="review-history-decision review-history-${escapeReviewCenterHtml(decision.decision)}">
              ${escapeReviewCenterHtml(
                REVIEW_STATUS_LABELS[decision.decision] ||
                decision.decision
              )}
            </span>
            <strong>${escapeReviewCenterHtml(decision.title)}</strong>
            <small>${escapeReviewCenterHtml(formatReviewDate(decision.occurredAt))}</small>
          </li>
        `;
      }).join('')
    : '<li class="review-model-empty">Решений пока нет.</li>';
}


function renderReviewCenter() {
  createReviewCenterUi();

  const queue = reviewCenterState.queue;
  const filtered =
    activeReviewFilter === 'all'
      ? queue
      : queue.filter(
          function (item) {
            return item.status === activeReviewFilter;
          }
        );

  const counters = {
    reviewCenterPendingCount:
      queue.filter(function (item) {
        return item.status === 'pending';
      }).length,
    reviewCenterClarificationCount:
      queue.filter(function (item) {
        return item.status === 'clarification';
      }).length,
    reviewCenterConfirmedCount:
      queue.filter(function (item) {
        return item.status === 'confirmed';
      }).length,
    reviewCenterDecisionsCount:
      reviewCenterState.decisions.length
  };

  Object.entries(counters).forEach(
    function ([id, value]) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = String(value);
      }
    }
  );

  const list = document.getElementById('reviewCenterQueue');

  if (list) {
    list.innerHTML = filtered.length
      ? filtered.map(renderReviewQueueItem).join('')
      : `
        <div class="review-center-empty">
          В выбранной группе выводов пока нет.
          Запустите сквозной пример или загрузите проектные документы.
        </div>
      `;
  }

  const filter = document.getElementById('reviewCenterFilter');
  if (filter) {
    filter.value = activeReviewFilter;
  }

  renderConfirmedModel();
  renderReviewDecisionHistory();
}


function createReviewCenterUi() {
  if (document.getElementById('reviewCenterSection')) {
    return document.getElementById('reviewCenterSection');
  }

  const layout = document.querySelector('main.layout');

  if (!layout) {
    return null;
  }

  const section = document.createElement('section');
  section.id = 'reviewCenterSection';
  section.className = 'review-center-section';
  section.innerHTML = `
    <section class="card review-center-hero">
      <div>
        <span class="review-center-eyebrow">REVIEW CENTER V1</span>
        <h2>Единый центр инженерной проверки</h2>
        <p class="muted">
          Все найденные документы, работы, материалы, сроки и изменения
          собираются в одну очередь. В модель проекта попадает только то,
          что подтвердил инженер.
        </p>
      </div>
      <div class="review-center-hero-actions">
        <button type="button" id="syncReviewCenterBtn" class="secondary">
          Собрать очередь
        </button>
        <button type="button" id="createReviewCenterDemoBtn" class="primary">
          Запустить сквозной пример
        </button>
      </div>
    </section>

    <section class="review-center-flow" aria-label="Сквозной процесс BuildMind">
      <div><span>1</span><strong>Документы</strong><small>загрузка и анализ</small></div>
      <div><span>2</span><strong>Выводы</strong><small>работы, материалы, сроки</small></div>
      <div><span>3</span><strong>Решение</strong><small>подтвердить или вернуть</small></div>
      <div><span>4</span><strong>Модель</strong><small>только проверенные данные</small></div>
    </section>

    <section class="review-center-summary">
      <div><strong id="reviewCenterPendingCount">0</strong><span>Ожидают решения</span></div>
      <div><strong id="reviewCenterClarificationCount">0</strong><span>Нужно уточнить</span></div>
      <div><strong id="reviewCenterConfirmedCount">0</strong><span>Подтверждено</span></div>
      <div><strong id="reviewCenterDecisionsCount">0</strong><span>Решений в истории</span></div>
    </section>

    <p id="reviewCenterMessage" class="review-center-message">
      Очередь синхронизируется с анализом документов и пакетами изменений.
    </p>

    <section class="review-center-workspace">
      <div class="review-center-queue-panel">
        <div class="card review-center-toolbar">
          <label>
            Показать
            <select id="reviewCenterFilter">
              <option value="all">Все выводы</option>
              <option value="pending">Ожидают решения</option>
              <option value="clarification">Нужно уточнить</option>
              <option value="confirmed">Подтверждённые</option>
              <option value="rejected">Отклонённые</option>
            </select>
          </label>
          <button type="button" id="confirmAllReviewItemsBtn" class="primary">
            Подтвердить все ожидающие
          </button>
        </div>

        <div id="reviewCenterQueue" class="review-center-queue"></div>
      </div>

      <aside>
        <section id="confirmedModelPanel" class="card review-model-panel"></section>
        <section class="card review-history-panel">
          <h2>Последние решения</h2>
          <ul id="reviewDecisionHistory" class="review-history-list"></ul>
        </section>
      </aside>
    </section>
  `;

  layout.appendChild(section);

  document.getElementById('syncReviewCenterBtn')
    ?.addEventListener('click', syncReviewCenterSources);

  document.getElementById('createReviewCenterDemoBtn')
    ?.addEventListener('click', createReviewCenterDemo);

  document.getElementById('reviewCenterFilter')
    ?.addEventListener('change', function (event) {
      activeReviewFilter = event.target.value || 'all';
      renderReviewCenter();
    });

  document.getElementById('confirmAllReviewItemsBtn')
    ?.addEventListener('click', function () {
      const button =
        document.getElementById(
          'confirmAllReviewItemsBtn'
        );

      const count = reviewCenterState.queue.filter(
        function (item) {
          return [
            'pending',
            'clarification'
          ].includes(item.status);
        }
      ).length;

      if (count === 0) {
        setReviewCenterMessage('Нет выводов, ожидающих решения.');
        return;
      }

      if (
        button &&
        button.dataset.reviewConfirmArmed !== 'true'
      ) {
        button.dataset.reviewConfirmArmed = 'true';
        button.textContent =
          `Подтвердить ${count} выводов — нажмите ещё раз`;

        setReviewCenterMessage(
          'Повторное нажатие зафиксирует решения в истории и обновит модель проекта.'
        );

        window.setTimeout(
          function () {
            if (
              button.dataset.reviewConfirmArmed ===
              'true'
            ) {
              button.dataset.reviewConfirmArmed = 'false';
              button.textContent =
                'Подтвердить все ожидающие';
            }
          },
          8000
        );

        return;
      }

      const confirmed = confirmPendingReviewItems();

      if (button) {
        button.dataset.reviewConfirmArmed = 'false';
        button.textContent =
          'Подтвердить все ожидающие';
      }

      setReviewCenterMessage(
        `Подтверждено выводов: ${confirmed}. Модель проекта обновлена.`
      );
    });

  section.addEventListener('click', function (event) {
    const button = event.target.closest('[data-review-action]');

    if (!button) {
      return;
    }

    const itemId = button.dataset.reviewId;
    const action = button.dataset.reviewAction;

    if (action === 'confirm') {
      decideReviewItem(
        itemId,
        'confirmed',
        'Подтверждено инженером.'
      );
      setReviewCenterMessage(
        'Вывод подтверждён и применён к модели проекта.'
      );
    }

    if (action === 'reject') {
      decideReviewItem(
        itemId,
        'rejected',
        'Отклонено инженером: вывод не применяется к модели.'
      );
      setReviewCenterMessage(
        'Вывод отклонён. Подтверждённая модель не изменена.'
      );
    }

    if (action === 'clarify') {
      const comment = prompt(
        'Что требуется уточнить?',
        'Проверить исходный документ и основание расчёта'
      );

      if (comment === null) {
        return;
      }

      decideReviewItem(
        itemId,
        'clarification',
        comment.trim() ||
          'Требуется дополнительная проверка.'
      );
      setReviewCenterMessage(
        'Вывод возвращён на уточнение и не применён к модели.'
      );
    }
  });

  return section;
}


window.addEventListener(
  'buildmind:project-intake-completed',
  syncReviewCenterSources
);

window.addEventListener(
  'buildmind:change-sets-changed',
  function () {
    syncChangeSetReviewItems();
    saveReviewCenterState();
    renderReviewCenter();
  }
);

window.addEventListener(
  'buildmind:project-documents-changed',
  function () {
    window.setTimeout(
      syncReviewCenterSources,
      900
    );
  }
);


window.BuildMindReviewCenter = {
  version: BUILDMIND_REVIEW_CENTER_VERSION,
  getState: function () {
    return cloneReviewCenterValue(reviewCenterState);
  },
  getQueue: function () {
    return cloneReviewCenterValue(reviewCenterState.queue);
  },
  getModel: function () {
    return cloneReviewCenterValue(reviewCenterState.model);
  },
  sync: syncReviewCenterSources,
  decide: decideReviewItem,
  confirmPending: confirmPendingReviewItems,
  createDemo: createReviewCenterDemo,
  refresh: renderReviewCenter
};


createReviewCenterUi();
syncChangeSetReviewItems();
saveReviewCenterState();
renderReviewCenter();


console.info(
  'BuildMind Review Center загружен:',
  BUILDMIND_REVIEW_CENTER_VERSION
);
