(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Storage — the ONLY code in this file that touches localStorage.
   * Everything else goes through these functions.
   * ------------------------------------------------------------------ */
  var Store = (function () {
    // Namespaced: Chrome shares one storage bucket across all file:// pages,
    // so a bare key like "quotes" could collide with any other local page.
    var KEY = 'quotesapp.v1';
    var VERSION = 1;
    var quotes = [];
    var broken = null;   // set if we found unreadable data, so we never overwrite it blind

    function newId() {
      // crypto.randomUUID needs a secure context, which file:// is not guaranteed
      // to be. Fall back rather than throw.
      try {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
          return window.crypto.randomUUID();
        }
      } catch (e) { /* fall through */ }
      return 'q-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function normalize(q) {
      var now = new Date().toISOString();
      return {
        id: typeof q.id === 'string' && q.id ? q.id : newId(),
        text: typeof q.text === 'string' ? q.text : '',
        author: typeof q.author === 'string' ? q.author : '',
        source: typeof q.source === 'string' ? q.source : '',
        note: typeof q.note === 'string' ? q.note : '',
        link: typeof q.link === 'string' ? q.link : '',
        tags: Array.isArray(q.tags) ? q.tags.filter(function (t) { return typeof t === 'string'; }) : [],
        createdAt: typeof q.createdAt === 'string' ? q.createdAt : now,
        updatedAt: typeof q.updatedAt === 'string' ? q.updatedAt : now
      };
    }

    function load() {
      var raw;
      try {
        raw = window.localStorage.getItem(KEY);
      } catch (e) {
        broken = 'Chrome refused to read local storage (' + e.message + '). ' +
                 'Nothing you add now will survive a restart.';
        quotes = [];
        return;
      }
      if (!raw) { quotes = []; return; }

      var data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        broken = 'Stored data could not be parsed. It has been left untouched rather ' +
                 'than overwritten — export nothing and ask for help before adding quotes.';
        quotes = [];
        return;
      }
      var list = data && Array.isArray(data.quotes) ? data.quotes : [];
      quotes = list.map(normalize).filter(function (q) { return q.text.trim() !== ''; });
    }

    function persist() {
      if (broken) return false;
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, quotes: quotes }));
        return true;
      } catch (e) {
        broken = 'Could not write to local storage (' + e.message + '). ' +
                 'Export now — recent changes are only in this tab.';
        return false;
      }
    }

    return {
      init: function () { load(); },
      problem: function () { return broken; },
      all: function () { return quotes.slice(); },
      count: function () { return quotes.length; },
      get: function (id) {
        for (var i = 0; i < quotes.length; i++) if (quotes[i].id === id) return quotes[i];
        return null;
      },
      add: function (fields) {
        var q = normalize(fields);
        quotes.push(q);
        persist();
        return q;
      },
      update: function (id, fields) {
        var q = this.get(id);
        if (!q) return null;
        ['text', 'author', 'source', 'note', 'link'].forEach(function (k) {
          if (typeof fields[k] === 'string') q[k] = fields[k];
        });
        q.updatedAt = new Date().toISOString();
        persist();
        return q;
      },
      remove: function (id) {
        quotes = quotes.filter(function (q) { return q.id !== id; });
        persist();
      },
      exportData: function () {
        return { version: VERSION, exportedAt: new Date().toISOString(), quotes: quotes };
      },
      // Returns {added, skipped}. Merge keeps everything already here and only
      // brings in quotes whose id isn't present — predictable, never silently
      // overwrites something you edited.
      importMerge: function (incoming) {
        var have = {}, added = 0, skipped = 0;
        quotes.forEach(function (q) { have[q.id] = true; });
        incoming.forEach(function (raw) {
          var q = normalize(raw);
          if (!q.text.trim()) { skipped++; return; }
          if (have[q.id]) { skipped++; return; }
          have[q.id] = true;
          quotes.push(q);
          added++;
        });
        persist();
        return { added: added, skipped: skipped };
      },
      importReplace: function (incoming) {
        var kept = incoming.map(normalize).filter(function (q) { return q.text.trim() !== ''; });
        quotes = kept;
        persist();
        return { added: kept.length, skipped: incoming.length - kept.length };
      }
    };
  })();

  /* ------------------------------------------------------------------ *
   * Small DOM helpers
   * ------------------------------------------------------------------ */
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;   // textContent everywhere: no escaping bugs
    return n;
  }
  function $(id) { return document.getElementById(id); }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /* ------------------------------------------------------------------ *
   * Notices
   * ------------------------------------------------------------------ */
  var transient = null;
  function notify(kind, message) {
    transient = { kind: kind, message: message };
    renderNotices();
  }
  function renderNotices() {
    var host = $('notices');
    host.textContent = '';

    var problem = Store.problem();
    if (problem) {
      var bad = el('div', 'notice bad');
      bad.appendChild(el('span', null, problem));
      host.appendChild(bad);
    }
    if (transient) {
      var n = el('div', 'notice ' + transient.kind);
      n.appendChild(el('span', null, transient.message));
      n.appendChild(el('span', 'spacer'));
      var close = el('button', 'link', 'dismiss');
      close.addEventListener('click', function () { transient = null; renderNotices(); });
      n.appendChild(close);
      host.appendChild(n);
    }
  }

  /* ------------------------------------------------------------------ *
   * Compose
   * ------------------------------------------------------------------ */
  var compose = $('compose');
  var fText = $('f-text');

  function composeFields() {
    return {
      text: fText.value.trim(),
      author: $('f-author').value.trim(),
      source: $('f-source').value.trim(),
      note: $('f-note').value.trim(),
      link: $('f-link').value.trim()
    };
  }
  function clearCompose() {
    ['f-text', 'f-author', 'f-source', 'f-note', 'f-link'].forEach(function (id) { $(id).value = ''; });
    $('optional').open = false;
    $('save').disabled = true;
  }

  fText.addEventListener('input', function () {
    $('save').disabled = fText.value.trim() === '';
  });

  // Ctrl/Cmd+Enter saves from the textarea — the keystroke you want when the
  // whole point is typing quotes in quickly.
  fText.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && fText.value.trim() !== '') {
      e.preventDefault();
      compose.requestSubmit();
    }
  });

  compose.addEventListener('submit', function (e) {
    e.preventDefault();
    var fields = composeFields();
    if (!fields.text) return;
    Store.add(fields);
    clearCompose();
    fText.focus();
    transient = null;
    render();
  });

  /* ------------------------------------------------------------------ *
   * List
   * ------------------------------------------------------------------ */
  var editingId = null;

  function renderQuote(q) {
    var card = el('article', 'quote');

    var bq = el('blockquote', null, q.text);
    card.appendChild(bq);

    if (q.author || q.source) {
      var attrib = el('p', 'attrib');
      if (q.author) attrib.appendChild(el('span', 'author', q.author));
      if (q.author && q.source) attrib.appendChild(el('span', null, ' — '));
      if (q.source) attrib.appendChild(el('span', 'source', q.source));
      card.appendChild(attrib);
    }

    if (q.note) card.appendChild(el('p', 'note', q.note));

    var meta = el('div', 'meta');
    meta.appendChild(el('span', null, formatDate(q.createdAt)));

    if (q.link) {
      meta.appendChild(el('span', null, '·'));
      if (/^https?:\/\//i.test(q.link)) {
        var a = el('a', null, q.link.replace(/^https?:\/\//i, '').slice(0, 48));
        a.href = q.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        meta.appendChild(a);
      } else {
        meta.appendChild(el('span', null, q.link));
      }
    }

    meta.appendChild(el('span', 'spacer'));

    var edit = el('button', 'link', 'edit');
    edit.addEventListener('click', function () { editingId = q.id; render(); });
    meta.appendChild(edit);

    var del = el('button', 'link danger', 'delete');
    del.addEventListener('click', function () {
      var preview = q.text.length > 60 ? q.text.slice(0, 60) + '…' : q.text;
      if (window.confirm('Delete this quote?\n\n' + preview)) {
        Store.remove(q.id);
        render();
      }
    });
    meta.appendChild(del);

    card.appendChild(meta);
    return card;
  }

  function renderEditor(q) {
    var card = el('article', 'quote');
    var form = el('form');

    var ta = el('textarea', 'text');
    ta.value = q.text;
    form.appendChild(ta);

    var fields = el('div', 'fields');
    function field(label, value, wide, multiline) {
      var l = el('label', wide ? 'wide' : null);
      l.appendChild(el('span', null, label));
      var input = el(multiline ? 'textarea' : 'input');
      if (!multiline) input.type = 'text';
      input.value = value;
      l.appendChild(input);
      fields.appendChild(l);
      return input;
    }
    var author = field('AUTHOR', q.author, false, false);
    var source = field('SOURCE', q.source, false, false);
    var note   = field('WHY YOU SAVED IT', q.note, true, true);
    var link   = field('LINK OR LOCATION', q.link, true, false);
    form.appendChild(fields);

    var actions = el('div', 'compose-actions');
    var save = el('button', 'primary', 'Save changes');
    save.type = 'submit';
    actions.appendChild(save);
    var cancel = el('button', 'link', 'cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', function () { editingId = null; render(); });
    actions.appendChild(cancel);
    form.appendChild(actions);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (ta.value.trim() === '') {
        window.alert('The quote text can\'t be empty. Delete it instead if that\'s what you want.');
        return;
      }
      Store.update(q.id, {
        text: ta.value.trim(),
        author: author.value.trim(),
        source: source.value.trim(),
        note: note.value.trim(),
        link: link.value.trim()
      });
      editingId = null;
      render();
    });

    card.appendChild(form);
    return card;
  }

  function render() {
    renderNotices();

    var quotes = Store.all().sort(function (a, b) {
      return b.createdAt.localeCompare(a.createdAt);   // newest first
    });

    $('count').textContent = quotes.length ? '· ' + quotes.length : '';

    var list = $('list');
    list.textContent = '';

    if (!quotes.length) {
      list.appendChild(el('p', 'empty', 'Nothing saved yet. Paste something above.'));
      return;
    }

    quotes.forEach(function (q) {
      list.appendChild(q.id === editingId ? renderEditor(q) : renderQuote(q));
    });
  }

  /* ------------------------------------------------------------------ *
   * Export / import
   * ------------------------------------------------------------------ */
  $('export').addEventListener('click', function () {
    var data = Store.exportData();
    if (!data.quotes.length) {
      notify('info', 'Nothing to export yet.');
      return;
    }
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'quotes-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    notify('info', 'Exported ' + data.quotes.length + ' quote' +
      (data.quotes.length === 1 ? '' : 's') +
      '. Keep it somewhere your backups actually reach.');
  });

  var pendingImport = null;
  var dialog = $('import-dialog');

  $('import').addEventListener('click', function () { $('file').click(); });

  $('file').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';           // so re-picking the same file fires again
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        notify('bad', 'That file isn\'t valid JSON, so nothing was changed.');
        return;
      }
      var incoming = data && Array.isArray(data.quotes) ? data.quotes
                   : Array.isArray(data) ? data
                   : null;
      if (!incoming) {
        notify('bad', 'That file doesn\'t look like a quotes export, so nothing was changed.');
        return;
      }
      if (!incoming.length) {
        notify('info', 'That file has no quotes in it. Nothing changed.');
        return;
      }
      pendingImport = incoming;
      $('import-count').textContent = incoming.length + ' quote' + (incoming.length === 1 ? '' : 's');
      $('import-detail').textContent = Store.count()
        ? 'You currently have ' + Store.count() + '. Merge adds only quotes you don\'t already ' +
          'have and changes nothing else. Replace throws away all ' + Store.count() + ' and cannot be undone.'
        : 'Your collection is empty, so both options do the same thing here.';
      dialog.showModal();
    };
    reader.onerror = function () { notify('bad', 'Could not read that file.'); };
    reader.readAsText(file);
  });

  $('import-cancel').addEventListener('click', function () {
    pendingImport = null;
    dialog.close();
  });

  $('import-merge').addEventListener('click', function () {
    if (!pendingImport) return;
    var r = Store.importMerge(pendingImport);
    pendingImport = null;
    dialog.close();
    notify('info', 'Merged: ' + r.added + ' added, ' + r.skipped + ' already here or empty.');
    render();
  });

  $('import-replace').addEventListener('click', function () {
    if (!pendingImport) return;
    if (!window.confirm('Replace all ' + Store.count() + ' quotes with the ' +
        pendingImport.length + ' in this file? This cannot be undone.')) return;
    var r = Store.importReplace(pendingImport);
    pendingImport = null;
    dialog.close();
    notify('info', 'Replaced. ' + r.added + ' quote' + (r.added === 1 ? '' : 's') + ' now stored.');
    render();
  });

  /* ------------------------------------------------------------------ */
  Store.init();
  render();
  fText.focus();
})();
