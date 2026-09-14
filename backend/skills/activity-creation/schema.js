const strings = ['title', 'date', 'startTime', 'startLocal', 'endLocal', 'categoryName', 'notes'];
module.exports = { type: 'OBJECT', properties: {
  reply: { type: 'STRING' }, ready: { type: 'BOOLEAN' }, mode: { type: 'STRING', enum: ['activity', 'about', 'unsupported'] },
  draft: { type: 'OBJECT', properties: {
    ...Object.fromEntries(strings.map(key => [key, { type: 'STRING' }])),
    durationMinutes: { type: 'INTEGER' }, allDay: { type: 'BOOLEAN' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    assumptions: { type: 'ARRAY', items: { type: 'STRING' } }
  }, required: [...strings, 'durationMinutes', 'allDay', 'tags', 'assumptions'] }
}, required: ['reply', 'ready', 'draft'] };
