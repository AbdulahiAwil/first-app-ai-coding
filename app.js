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
        // Trimmed, unlike the other strings: this one is a grouping key, and
        // " Stoicism" from a hand-edited import must not become its own group.
        category: typeof q.category === 'string' ? q.category.trim() : '',
        tags: Array.isArray(q.tags) ? q.tags.filter(function (t) { return typeof t === 'string'; }) : [],
        // === true, not truthy: junk from a hand-edited import lands on false
        // rather than becoming a favorite by accident.
        favorite: q.favorite === true,
        favoritedAt: q.favorite === true
          ? (typeof q.favoritedAt === 'string' && q.favoritedAt ? q.favoritedAt : now)
          : '',
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
        // Refiling a quote is an edit of the quote, so it belongs on this side
        // of the line and does bump updatedAt (unlike favorite).
        if (typeof fields.category === 'string') q.category = fields.category.trim();
        q.updatedAt = new Date().toISOString();
        persist();
        return q;
      },
      // Deliberately does NOT bump updatedAt — starring is a reaction to a quote,
      // not an edit of it.
      setFavorite: function (id, on) {
        var q = this.get(id);
        if (!q) return null;
        q.favorite = !!on;
        q.favoritedAt = q.favorite ? new Date().toISOString() : '';
        persist();
        return q;
      },
      // {list: [{name, count}] sorted alphabetically, uncategorized: n}
      categories: function () {
        var counts = {}, loose = 0;
        quotes.forEach(function (q) {
          if (q.category) counts[q.category] = (counts[q.category] || 0) + 1;
          else loose++;
        });
        var names = Object.keys(counts).sort(function (a, b) {
          return a.localeCompare(b, undefined, { sensitivity: 'base' });
        });
        return {
          list: names.map(function (n) { return { name: n, count: counts[n] }; }),
          uncategorized: loose
        };
      },
      favoriteCount: function () {
        var n = 0;
        quotes.forEach(function (q) { if (q.favorite) n++; });
        return n;
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
  var composeFav = false;

  function renderComposeFav() {
    var b = $('f-fav');
    b.textContent = (composeFav ? '★' : '☆') + ' Favorite';
    b.setAttribute('aria-pressed', composeFav ? 'true' : 'false');
    b.className = composeFav ? 'fav-toggle on' : 'fav-toggle';
  }
  $('f-fav').addEventListener('click', function () {
    composeFav = !composeFav;
    renderComposeFav();
  });

  function composeFields() {
    return {
      text: fText.value.trim(),
      author: $('f-author').value.trim(),
      source: $('f-source').value.trim(),
      category: $('f-category').value.trim(),
      note: $('f-note').value.trim(),
      link: $('f-link').value.trim(),
      favorite: composeFav
    };
  }
  function clearCompose() {
    ['f-text', 'f-author', 'f-source', 'f-category', 'f-note', 'f-link'].forEach(function (id) { $(id).value = ''; });
    $('optional').open = false;
    $('save').disabled = true;
    composeFav = false;
    renderComposeFav();
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
    var saved = Store.add(fields);
    // A quote starred at capture time should appear even if the favorites view
    // is already open, so it joins the snapshot rather than waiting for a toggle.
    if (filterFavorites && saved.favorite) favSnapshot[saved.id] = true;
    // Saving into a group you aren't looking at would otherwise render as
    // nothing happening at all, so drop back to the full list.
    if (filterCategory !== null && saved.category !== filterCategory) filterCategory = null;
    clearCompose();
    fText.focus();
    transient = null;
    render();
  });

  /* ------------------------------------------------------------------ *
   * List
   * ------------------------------------------------------------------ */
  var editingId = null;

  // Favorites view state. Deliberately NOT persisted: opening the app to a
  // filtered list looks exactly like losing your collection.
  var filterFavorites = false;
  // Set of ids the favourites view is showing. Built when the filter turns on
  // and only ever grows while it's open, so un-starring doesn't yank a card out
  // from under the cursor.
  var favSnapshot = null;

  // Category view state, also not persisted. null = every quote, '' = the
  // uncategorized ones, otherwise the exact category name. No snapshot here:
  // refiling a quote out of the group you're reading is a move you asked for,
  // so watching it leave is the honest result.
  var filterCategory = null;

  // Deterministic colour slot for a category name. The same group gets the same
  // hue on every reload and on every surface it appears on, without storing a
  // colour on the quote — the palette itself stays in style.css as .c0-.c7.
  function categoryClass(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100003;
    return 'c' + (h % 8);
  }

  function starButton(q) {
    var b = el('button', q.favorite ? 'fav on' : 'fav', q.favorite ? '★' : '☆');
    b.type = 'button';
    b.setAttribute('aria-pressed', q.favorite ? 'true' : 'false');
    b.setAttribute('aria-label', q.favorite ? 'Remove from favorites' : 'Add to favorites');
    b.title = q.favorite ? 'Remove from favorites' : 'Add to favorites';
    b.addEventListener('click', function () {
      var on = !q.favorite;
      Store.setFavorite(q.id, on);
      if (filterFavorites && on) favSnapshot[q.id] = true;
      render();
    });
    return b;
  }

  function renderQuote(q) {
    var card = el('article', q.favorite ? 'quote is-fav' : 'quote');
    if (q.category) card.classList.add('has-cat', categoryClass(q.category));

    card.appendChild(starButton(q));

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

    if (q.category) {
      var cat = el('button', 'cat ' + categoryClass(q.category), q.category);
      cat.type = 'button';
      cat.title = 'Show only ' + q.category;
      cat.addEventListener('click', function () { filterCategory = q.category; render(); });
      meta.appendChild(cat);
      meta.appendChild(el('span', null, '·'));
    }

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
    // Keeps the accent edge so it doesn't flicker off mid-edit, but no star —
    // one control per card, and Store.update() can't touch the flag anyway.
    var card = el('article', q.favorite ? 'quote is-fav' : 'quote');
    if (q.category) card.classList.add('has-cat', categoryClass(q.category));
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
    var author   = field('AUTHOR', q.author, false, false);
    var source   = field('SOURCE', q.source, false, false);
    var category = field('CATEGORY', q.category, false, false);
    category.setAttribute('list', 'category-list');   // same suggestions as compose
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
        category: category.value.trim(),
        note: note.value.trim(),
        link: link.value.trim()
      });
      editingId = null;
      render();
    });

    card.appendChild(form);
    return card;
  }

  function renderFilter(favCount) {
    var host = $('filter');
    host.textContent = '';
    // Nothing starred yet means nothing to filter — the card stars are the
    // discovery path, so a dead toggle here would just be a wasted click.
    // But never hide it while the filter is ON: un-starring your last favorite
    // would strand you in a filtered view with no way back out.
    if (!favCount && !filterFavorites) return;

    var b = el('button', filterFavorites ? 'fav-toggle on' : 'fav-toggle',
      (filterFavorites ? '★' : '☆') + ' Favorites · ' + favCount);
    b.type = 'button';
    b.setAttribute('aria-pressed', filterFavorites ? 'true' : 'false');
    b.addEventListener('click', function () {
      filterFavorites = !filterFavorites;
      if (filterFavorites) {
        favSnapshot = {};
        Store.all().forEach(function (q) { if (q.favorite) favSnapshot[q.id] = true; });
      } else {
        favSnapshot = null;
      }
      render();
    });
    host.appendChild(b);
  }

  // Feeds the <datalist> both category inputs point at, so refiling a quote
  // means picking the group you already made rather than retyping it slightly
  // differently and splitting it in two.
  function syncCategoryList(list) {
    var host = $('category-list');
    host.textContent = '';
    list.forEach(function (c) {
      var o = el('option');
      o.value = c.name;
      host.appendChild(o);
    });
  }

  function renderCategories(info, total) {
    var host = $('categories');
    host.textContent = '';
    if (!info.list.length && filterCategory === null) return;

    function chip(label, value, count) {
      var on = filterCategory === value;
      var b = el('button', on ? 'cat-chip on' : 'cat-chip', label + ' · ' + count);
      // Named groups only. "All" and "Uncategorized" stay neutral so they read
      // as controls rather than as two more groups.
      if (value) b.classList.add(categoryClass(value));
      b.type = 'button';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () {
        filterCategory = on ? null : value;
        render();
      });
      host.appendChild(b);
    }

    // Always present while a group is open. Groups disappear as you empty them,
    // so without a fixed way back you could be left filtered to a category that
    // no longer has a chip.
    if (filterCategory !== null) chip('All', null, total);
    info.list.forEach(function (c) { chip(c.name, c.name, c.count); });
    if (info.uncategorized) chip('Uncategorized', '', info.uncategorized);
  }

  function render() {
    renderNotices();

    var all = Store.all().sort(function (a, b) {
      return b.createdAt.localeCompare(a.createdAt);   // newest first
    });

    var favCount = Store.favoriteCount();
    // Always the total, never the filtered count — the header shouldn't read
    // like quotes went missing.
    $('count').textContent = all.length ? '· ' + all.length : '';
    renderFilter(favCount);

    var cats = Store.categories();
    syncCategoryList(cats.list);
    renderCategories(cats, all.length);

    // Filter after sorting; neither filter reorders the list.
    var quotes = all;
    if (filterFavorites) {
      quotes = quotes.filter(function (q) { return favSnapshot[q.id] === true; });
    }
    if (filterCategory !== null) {
      quotes = quotes.filter(function (q) { return q.category === filterCategory; });
    }

    var list = $('list');
    list.textContent = '';

    if (!quotes.length) {
      var message;
      if (filterCategory !== null && filterFavorites) {
        message = 'Nothing starred in this group.';
      } else if (filterCategory !== null) {
        message = filterCategory
          ? 'Nothing left in ' + filterCategory + '.'
          : 'Every quote has a category.';
      } else if (filterFavorites) {
        message = 'No favorites in view. Turn the filter off and star something.';
      } else {
        message = 'Nothing saved yet. Paste something above.';
      }
      list.appendChild(el('p', 'empty', message));
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
  renderComposeFav();
  render();
  fText.focus();
})();
