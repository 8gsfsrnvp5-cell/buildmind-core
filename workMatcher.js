'use strict';

/*
  ==================================================
  BUILDMIND WORK MATCHER — DEMO V1
  ==================================================

  Назначение:
  - сопоставлять реальные названия работ из ГПР
    с типовыми работами Road Knowledge Base;
  - выдавать уровень уверенности;
  - не подменять инженерное решение.

  Все результаты требуют проверки
  ответственным специалистом.
*/

const BUILDMIND_WORK_MATCHER_VERSION =
  'work-matcher-demo-v1';


function normalizeWorkMatcherText(
  value
) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'()]/g, ' ')
    .replace(/[.,;:]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function tokenizeWorkMatcherText(
  value
) {
  const normalized =
    normalizeWorkMatcherText(
      value
    );

  if (!normalized) {
    return [];
  }

  const stopWords =
    new Set([
      'на',
      'в',
      'по',
      'для',
      'из',
      'под',
      'над',
      'при',
      'и',
      'или',
      'до',
      'от',
      'к'
    ]);

  return normalized
    .split(' ')
    .filter(function (word) {
      return (
        word.length >= 2 &&
        !stopWords.has(word)
      );
    });
}


function getWorkMatcherRoot(
  word
) {
  const normalized =
    normalizeWorkMatcherText(
      word
    );

  if (
    normalized.length <= 4
  ) {
    return normalized;
  }

  const endings = [
    'иями',
    'ями',
    'ами',
    'ого',
    'ему',
    'ому',
    'ыми',
    'ими',
    'ий',
    'ый',
    'ой',
    'ая',
    'яя',
    'ое',
    'ее',
    'ые',
    'ие',
    'ов',
    'ев',
    'ей',
    'ам',
    'ям',
    'ах',
    'ях',
    'ом',
    'ем',
    'а',
    'я',
    'ы',
    'и',
    'у',
    'ю',
    'е',
    'о'
  ];

  const ending =
    endings.find(function (
      item
    ) {
      return (
        normalized.endsWith(
          item
        ) &&
        normalized.length -
          item.length >=
          4
      );
    });

  if (!ending) {
    return normalized;
  }

  return normalized.slice(
    0,
    -ending.length
  );
}


function getWorkMatcherRoots(
  value
) {
  return tokenizeWorkMatcherText(
    value
  ).map(
    getWorkMatcherRoot
  );
}


function calculateWorkMatcherScore(
  query,
  workItem
) {
  const normalizedQuery =
    normalizeWorkMatcherText(
      query
    );

  if (
    !normalizedQuery ||
    !workItem
  ) {
    return {
      score: 0,
      reasons: []
    };
  }

  const searchableValues = [
    workItem.name,
    ...(workItem.aliases || [])
  ];

  let bestScore = 0;
  let bestReasons = [];

  searchableValues.forEach(
    function (candidateValue) {
      const normalizedCandidate =
        normalizeWorkMatcherText(
          candidateValue
        );

      if (!normalizedCandidate) {
        return;
      }

      let score = 0;
      const reasons = [];

      /*
        1. Полное совпадение
      */

      if (
        normalizedQuery ===
        normalizedCandidate
      ) {
        score = 100;

        reasons.push(
          'Точное совпадение с типовым названием или псевдонимом.'
        );
      }

      /*
        2. Типовой alias полностью входит
           в реальное название работы.

        Например:

        "подземная кабельная канализация"

        входит в:

        "прокладка подземной кабельной канализации"
      */

      else if (
        normalizedQuery.includes(
          normalizedCandidate
        )
      ) {
        score = 92;

        reasons.push(
          'Типовое название или псевдоним полностью входит в название работы.'
        );
      }

      /*
        3. Реальное название входит
           в типовое название.
      */

      else if (
        normalizedCandidate.includes(
          normalizedQuery
        )
      ) {
        score = 88;

        reasons.push(
          'Название работы входит в типовое название или псевдоним.'
        );
      }

      /*
        4. Если прямого совпадения нет,
           считаем совпадение по основам слов.
      */

      else {
        const queryRoots =
          getWorkMatcherRoots(
            normalizedQuery
          );

        const candidateRoots =
          getWorkMatcherRoots(
            normalizedCandidate
          );

        const matchedRoots =
          queryRoots.filter(
            function (queryRoot) {
              return candidateRoots.some(
                function (
                  candidateRoot
                ) {
                  return (
                    queryRoot ===
                      candidateRoot ||
                    (
                      queryRoot.length >=
                        4 &&
                      candidateRoot.length >=
                        4 &&
                      (
                        queryRoot.startsWith(
                          candidateRoot
                        ) ||
                        candidateRoot.startsWith(
                          queryRoot
                        )
                      )
                    )
                  );
                }
              );
            }
          );

        const uniqueMatchedRoots =
          Array.from(
            new Set(
              matchedRoots
            )
          );

        /*
          Используем длину более длинной
          последовательности.

          Это специально снижает уверенность,
          если совпала только малая часть
          длинного названия работы.
        */

        const comparisonLength =
          Math.max(
            1,
            Math.max(
              queryRoots.length,
              candidateRoots.length
            )
          );

        const rootRatio =
          uniqueMatchedRoots.length /
          comparisonLength;

        score =
          Math.round(
            rootRatio * 75
          );

        if (
          uniqueMatchedRoots.length >
          0
        ) {
          reasons.push(
            `Совпали ключевые основы: ` +
            uniqueMatchedRoots.join(
              ', '
            ) +
            '.'
          );
        }
      }

      if (
        score > bestScore
      ) {
        bestScore = score;
        bestReasons = reasons;
      }
    }
  );

  return {
    score:
      Math.min(
        Math.round(
          bestScore
        ),
        100
      ),

    reasons:
      bestReasons
  };
}

  const searchableValues = [
    workItem.name,
    ...(workItem.aliases || [])
  ];

  let bestScore = 0;
  let bestReasons = [];

  searchableValues.forEach(
    function (candidateValue) {
      const normalizedCandidate =
        normalizeWorkMatcherText(
          candidateValue
        );

      if (!normalizedCandidate) {
        return;
      }

      let score = 0;
      const reasons = [];

      if (
        normalizedQuery ===
        normalizedCandidate
      ) {
        score += 100;
        reasons.push(
          'Точное совпадение названия.'
        );
      }

      if (
        normalizedQuery.includes(
          normalizedCandidate
        ) ||
        normalizedCandidate.includes(
          normalizedQuery
        )
      ) {
        score += 60;
        reasons.push(
          'Одно название входит в другое.'
        );
      }

      const queryRoots =
        getWorkMatcherRoots(
          normalizedQuery
        );

      const candidateRoots =
        getWorkMatcherRoots(
          normalizedCandidate
        );

      const matchedRoots =
        queryRoots.filter(
          function (queryRoot) {
            return candidateRoots.some(
              function (
                candidateRoot
              ) {
                return (
                  queryRoot ===
                    candidateRoot ||
                  (
                    queryRoot.length >=
                      4 &&
                    candidateRoot.length >=
                      4 &&
                    (
                      queryRoot.startsWith(
                        candidateRoot
                      ) ||
                      candidateRoot.startsWith(
                        queryRoot
                      )
                    )
                  )
                );
              }
            );
          }
        );

      const uniqueMatchedRoots =
        Array.from(
          new Set(
            matchedRoots
          )
        );

      const baseLength =
        Math.max(
          1,
          Math.min(
            queryRoots.length,
            candidateRoots.length
          )
        );

      const rootRatio =
        uniqueMatchedRoots.length /
        baseLength;

      score +=
        rootRatio * 40;

      if (
        uniqueMatchedRoots.length >
        0
      ) {
        reasons.push(
          `Совпали ключевые основы: ` +
          uniqueMatchedRoots.join(
            ', '
          ) +
          '.'
        );
      }

      if (
        score > bestScore
      ) {
        bestScore = score;
        bestReasons = reasons;
      }
    }
  );

  return {
    score:
      Math.min(
        Math.round(
          bestScore
        ),
        100
      ),

    reasons:
      bestReasons
  };
}


function getWorkMatcherConfidence(
  score
) {
  if (score >= 85) {
    return {
      level:
        'high',

      label:
        'Высокая'
    };
  }

  if (score >= 60) {
    return {
      level:
        'medium',

      label:
        'Средняя'
    };
  }

  if (score >= 40) {
    return {
      level:
        'low',

      label:
        'Низкая'
    };
  }

  return {
    level:
      'none',

    label:
      'Недостаточно данных'
  };
}


function findBuildMindWorkMatch(
  workName
) {
  const knowledge =
    window.BuildMindRoadKnowledge;

  if (
    !knowledge ||
    !Array.isArray(
      knowledge.works
    )
  ) {
    return {
      success: false,

      errorCode:
        'KNOWLEDGE_BASE_NOT_FOUND',

      errorMessage:
        'Road Knowledge Base не найдена.'
    };
  }

  const normalizedWorkName =
    normalizeWorkMatcherText(
      workName
    );

  if (!normalizedWorkName) {
    return {
      success: false,

      errorCode:
        'WORK_NAME_REQUIRED',

      errorMessage:
        'Название работы не указано.'
    };
  }

  const candidates =
    knowledge.works
      .map(
        function (workItem) {
          const result =
            calculateWorkMatcherScore(
              workName,
              workItem
            );

          return {
            workItem,
            score:
              result.score,
            reasons:
              result.reasons
          };
        }
      )
      .sort(
        function (
          first,
          second
        ) {
          return (
            second.score -
            first.score
          );
        }
      );

  const bestCandidate =
    candidates[0];

  const confidence =
    getWorkMatcherConfidence(
      bestCandidate
        ? bestCandidate.score
        : 0
    );

  if (
    !bestCandidate ||
    bestCandidate.score < 40
  ) {
    return {
      success: false,

      errorCode:
        'WORK_MATCH_NOT_CONFIDENT',

      errorMessage:
        'Надёжное соответствие работы не найдено.',

      requestedWork:
        workName,

      confidence,

      alternatives:
        candidates
          .slice(0, 3)
          .map(
            function (item) {
              return {
                workId:
                  item.workItem.id,

                name:
                  item.workItem.name,

                score:
                  item.score
              };
            }
          ),

      requiresEngineerConfirmation:
        true
    };
  }

  return {
    success: true,

    version:
      BUILDMIND_WORK_MATCHER_VERSION,

    requestedWork:
      workName,

    matchedWork: {
      id:
        bestCandidate
          .workItem.id,

      name:
        bestCandidate
          .workItem.name,

      categoryId:
        bestCandidate
          .workItem.categoryId,

      categoryName:
        bestCandidate
          .workItem.categoryName
    },

    score:
      bestCandidate.score,

    confidence,

    reasons:
      bestCandidate.reasons,

    alternatives:
      candidates
        .slice(1, 4)
        .map(
          function (item) {
            return {
              workId:
                item.workItem.id,

              name:
                item.workItem.name,

              score:
                item.score
            };
          }
        ),

    requiresEngineerConfirmation:
      confidence.level !==
      'high',

    decisionStatus:
      confidence.level ===
      'high'
        ? 'auto-match-reviewable'
        : 'requires-review',

    disclaimer:
      'Соответствие определено автоматически. ' +
      'Рекомендуется проверить тип работы ' +
      'и подтвердить результат ответственным специалистом.'
  };
}


function getWorkMatcherSummary() {
  const knowledge =
    window.BuildMindRoadKnowledge;

  return {
    version:
      BUILDMIND_WORK_MATCHER_VERSION,

    knowledgeWorksCount:
      knowledge &&
      Array.isArray(
        knowledge.works
      )
        ? knowledge.works.length
        : 0
  };
}


window.BuildMindWorkMatcher = {
  version:
    BUILDMIND_WORK_MATCHER_VERSION,

  normalizeText:
    normalizeWorkMatcherText,

  calculateScore:
    calculateWorkMatcherScore,

  find:
    findBuildMindWorkMatch,

  getSummary:
    getWorkMatcherSummary
};


console.info(
  'BuildMind Work Matcher загружен:',
  getWorkMatcherSummary()
);
