/* Draws the charts on a report page (see chart.ts for the data). Inlined, only on pages that have one. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var FMT = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });

  function el(parent, name, attrs, text) {
    var node = document.createElementNS(NS, name);
    for (var key in attrs) node.setAttribute(key, attrs[key]);
    if (text !== undefined) node.textContent = text;
    parent.appendChild(node);
    return node;
  }
  function div(parent, cls, text) {
    var node = document.createElement('div');
    node.className = cls;
    if (text !== undefined) node.textContent = text;
    parent.appendChild(node);
    return node;
  }
  function widest(svg, texts) {
    var probe = el(svg, 'text', {});
    var most = 0;
    texts.forEach(function (t) {
      probe.textContent = t;
      most = Math.max(most, probe.getComputedTextLength ? probe.getComputedTextLength() : t.length * 7);
    });
    probe.remove();
    return most;
  }
  /* Round ticks that cover the numbers, always from zero so lengths and slopes are not exaggerated. */
  function ticks(low, high, count) {
    var rough = (high - low || 1) / count;
    var power = Math.pow(10, Math.floor(Math.log10(rough)));
    var step = [1, 2, 2.5, 5, 10].find(function (m) { return m * power >= rough * 0.999; }) * power;
    var out = [];
    for (var i = Math.floor(low / step + 1e-9); i <= Math.ceil(high / step - 1e-9); i++) out.push(+(i * step).toPrecision(12));
    return out.length > 1 ? out : [0, step];
  }
  /* A bar with its far end rounded and its end at the baseline square. */
  function barPath(x, y, w, h, side) {
    var r = side ? Math.min(4, w, h) : 0;
    if (side === 'right') { r = Math.min(r, h / 2); return 'M' + x + ',' + y + 'h' + (w - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (h - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + -r + ',' + r + 'h' + -(w - r) + 'z'; }
    if (side === 'left') { r = Math.min(r, h / 2); return 'M' + (x + w) + ',' + y + 'h' + -(w - r) + 'a' + r + ',' + r + ' 0 0 0 ' + -r + ',' + r + 'v' + (h - 2 * r) + 'a' + r + ',' + r + ' 0 0 0 ' + r + ',' + r + 'h' + (w - r) + 'z'; }
    if (side === 'top') { r = Math.min(r, w / 2); return 'M' + x + ',' + (y + h) + 'v' + -(h - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + -r + 'h' + (w - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (h - r) + 'z'; }
    if (side === 'bottom') { r = Math.min(r, w / 2); return 'M' + x + ',' + y + 'v' + (h - r) + 'a' + r + ',' + r + ' 0 0 0 ' + r + ',' + r + 'h' + (w - 2 * r) + 'a' + r + ',' + r + ' 0 0 0 ' + r + ',' + -r + 'v' + -(h - r) + 'z'; }
    return 'M' + x + ',' + y + 'h' + w + 'v' + h + 'h' + -w + 'z';
  }

  function chart(figure) {
    var spec = JSON.parse(figure.querySelector('script').textContent);
    var plot = figure.querySelector('.plot');
    var n = spec.labels.length;
    var all = [];
    if (spec.stacked) spec.labels.forEach(function (_, i) { all.push(spec.series.reduce(function (sum, s) { return sum + s.values[i]; }, 0)); });
    else spec.series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null) all.push(v); }); });
    var low = Math.min.apply(null, [0].concat(all));
    var high = Math.max.apply(null, [0].concat(all));
    var withUnit = function (v) { return FMT.format(v) + (spec.unit === '%' ? '%' : spec.unit ? ' ' + spec.unit : ''); };
    var tick = function (v) { return FMT.format(v) + (spec.unit === '%' ? '%' : ''); };
    var numeric = spec.type === 'line' && spec.labels.every(function (l) { return /^-?\d+(\.\d+)?$/.test(l); });
    var width = 0;
    var active = -1;
    var positions, marker, tip, live;

    function draw() {
      width = plot.clientWidth;
      if (!width) return;
      plot.textContent = '';
      var svg = el(plot, 'svg', { 'aria-hidden': 'true' });
      tip = div(plot, 'tip');
      tip.hidden = true;
      live = div(plot, 'sr');
      live.setAttribute('aria-live', 'polite');
      active = -1;
      if (spec.type === 'bar') bars(svg); else upright(svg);
    }
    function size(svg, height) {
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      svg.setAttribute('height', height);
    }

    /* Lines and columns: labels along the bottom, numbers up the side. */
    function upright(svg) {
      var height = width < 480 ? 270 : 350;
      var marks = ticks(low, high, height < 300 ? 4 : 5);
      var left = Math.ceil(widest(svg, marks.map(tick))) + 10;
      var lastValues = spec.series.map(function (s) { return s.values[n - 1]; }).filter(function (v) { return v !== null; });
      var right = spec.type === 'line' ? Math.ceil(widest(svg, lastValues.map(tick))) + 14 : 4;
      var top = 12;
      var bottom = height - 28;
      size(svg, height);
      var y = function (v) { return bottom - ((v - marks[0]) / (marks[marks.length - 1] - marks[0])) * (bottom - top); };
      marks.forEach(function (m) {
        el(svg, 'line', { x1: left, x2: width - right, y1: y(m), y2: y(m), class: m === 0 ? 'base' : 'grid' });
        el(svg, 'text', { x: left - 8, y: y(m), dy: '0.35em', 'text-anchor': 'end' }, tick(m));
      });
      var span = width - right - left;
      var band = span / n;
      if (numeric) {
        var first = +spec.labels[0];
        var range = +spec.labels[n - 1] - first;
        positions = spec.labels.map(function (l) { return left + 4 + ((+l - first) / range) * (span - 4); });
      } else positions = spec.labels.map(function (_, i) { return left + band * (i + 0.5); });

      /* As many labels as fit side by side; never two on top of each other. */
      var need = widest(svg, spec.labels) + 14;
      var every = Math.max(1, Math.ceil(need / Math.max(1, (positions[n - 1] - positions[0]) / (n - 1))));
      var edge = -Infinity;
      spec.labels.forEach(function (label, i) {
        if (i % every) return;
        var w = widest(svg, [label]);
        var x = Math.max(w / 2, Math.min(width - w / 2, positions[i]));
        if (x - w / 2 < edge + 6) return;
        edge = x + w / 2;
        el(svg, 'text', { x: x, y: height - 8, 'text-anchor': 'middle' }, label);
      });

      if (spec.type === 'line') {
        marker = el(svg, 'g', {});
        var ends = [];
        spec.series.forEach(function (s, k) {
          var path = '';
          var pen = false;
          s.values.forEach(function (v, i) {
            if (v === null) { pen = false; return; }
            path += (pen ? 'L' : 'M') + positions[i].toFixed(1) + ',' + y(v).toFixed(1);
            /* A point with a gap on both sides would not show as a line. */
            if (!pen && (i === n - 1 || s.values[i + 1] === null)) el(svg, 'circle', { cx: positions[i], cy: y(v), r: 3, class: 'fill s' + (k + 1) });
            pen = true;
          });
          el(svg, 'path', { d: path, class: 'line s' + (k + 1) });
          var end = s.values[n - 1];
          if (end !== null) {
            el(svg, 'circle', { cx: positions[n - 1], cy: y(end), r: 4, class: 'dot s' + (k + 1) });
            if (ends.every(function (e) { return Math.abs(e - y(end)) > 15; })) {
              ends.push(y(end));
              el(svg, 'text', { x: positions[n - 1] + 8, y: y(end), dy: '0.35em', class: 'value' }, tick(end));
            }
          }
        });
        svg.appendChild(marker);
        watch(svg, function (i) {
          marker.textContent = '';
          if (i < 0) return;
          el(marker, 'line', { x1: positions[i], x2: positions[i], y1: top, y2: bottom, class: 'cross' });
          spec.series.forEach(function (s, k) {
            if (s.values[i] !== null) el(marker, 'circle', { cx: positions[i], cy: y(s.values[i]), r: 5, class: 'dot s' + (k + 1) });
          });
        }, function (i) { return [positions[i], top]; }, function (px) { return nearest(px); });
        return;
      }

      marker = el(svg, 'rect', { y: top, width: band, height: bottom - top, class: 'hit', visibility: 'hidden' });
      var lanes = spec.stacked ? 1 : spec.series.length;
      var thick = Math.max(1, Math.min(24 + (lanes === 1 ? 16 : 0), (band * 0.76 - 2 * (lanes - 1)) / lanes));
      spec.labels.forEach(function (_, i) {
        var from = 0;
        spec.series.forEach(function (s, k) {
          var v = s.values[i];
          if (!v) return;
          var lane = spec.stacked ? 0 : k;
          var x = positions[i] - (thick * lanes + 2 * (lanes - 1)) / 2 + lane * (thick + 2);
          var a = y(spec.stacked ? from : 0);
          var b = y(spec.stacked ? from + v : v);
          var above = spec.stacked && from > 0 ? 2 : 0;
          from += v;
          var last = !spec.stacked || !spec.series.slice(k + 1).some(function (o) { return o.values[i]; });
          var h = Math.max(0.5, Math.abs(a - b) - above);
          el(svg, 'path', { d: barPath(x, Math.min(a, b), thick, h, last ? (v > 0 ? 'top' : 'bottom') : ''), class: 'fill s' + (k + 1) });
        });
      });
      watch(svg, function (i) {
        marker.setAttribute('visibility', i < 0 ? 'hidden' : 'visible');
        if (i >= 0) marker.setAttribute('x', positions[i] - band / 2);
      }, function (i) { return [positions[i], top]; }, function (px) { return nearest(px); });
    }

    /* Bars: a label beside each, or above it where the screen is narrow. */
    function bars(svg) {
      var lanes = spec.stacked ? 1 : spec.series.length;
      var labelWidth = widest(svg, spec.labels);
      var over = labelWidth > width * 0.36;
      var thick = lanes === 1 ? 20 : 14;
      var pitch = lanes * thick + 2 * (lanes - 1) + (over ? 36 : 14);
      var left = over ? 1 : Math.ceil(labelWidth) + 12;
      var single = lanes === 1 && (spec.stacked || spec.series.length === 1);
      var totals = spec.labels.map(function (_, i) { return spec.stacked ? spec.series.reduce(function (sum, s) { return sum + s.values[i]; }, 0) : spec.series[0].values[i]; });
      var right = single ? Math.ceil(widest(svg, totals.filter(function (v) { return v !== null; }).map(tick))) + 10 : 12;
      var top = 4;
      var bottom = top + pitch * n;
      var height = bottom + 26;
      size(svg, height);
      var marks = ticks(low, high, width < 480 ? 3 : 5);
      var pad = low < 0 && single ? right : 0;
      var x = function (v) { return left + pad + ((v - marks[0]) / (marks[marks.length - 1] - marks[0])) * (width - right - left - pad); };
      marker = el(svg, 'rect', { x: 0, width: width, height: pitch, class: 'hit', visibility: 'hidden' });
      marks.forEach(function (m) {
        el(svg, 'line', { x1: x(m), x2: x(m), y1: top, y2: bottom, class: m === 0 ? 'base' : 'grid' });
        var w = widest(svg, [tick(m)]);
        el(svg, 'text', { x: Math.max(w / 2, Math.min(width - w / 2, x(m))), y: height - 6, 'text-anchor': 'middle' }, tick(m));
      });
      positions = spec.labels.map(function (_, i) { return top + pitch * (i + 0.5); });
      spec.labels.forEach(function (label, i) {
        var y0 = top + pitch * i + (over ? 24 : 7);
        var inner = lanes * thick + 2 * (lanes - 1);
        el(svg, 'text', over ? { x: left, y: y0 - 7, class: 'label' } : { x: left - 10, y: y0 + inner / 2, dy: '0.35em', 'text-anchor': 'end', class: 'label' }, label);
        var from = 0;
        spec.series.forEach(function (s, k) {
          var v = s.values[i];
          if (!v) return;
          var a = x(spec.stacked ? from : 0);
          var b = x(spec.stacked ? from + v : v);
          var gap = spec.stacked && from > 0 ? 2 : 0;
          from += v;
          var last = !spec.stacked || !spec.series.slice(k + 1).some(function (o) { return o.values[i]; });
          el(svg, 'path', { d: barPath(Math.min(a, b) + gap, y0 + (spec.stacked ? 0 : k * (thick + 2)), Math.max(0.5, Math.abs(b - a) - gap), thick, last ? (v > 0 ? 'right' : 'left') : ''), class: 'fill s' + (k + 1) });
        });
        if (single && totals[i] !== null) {
          var below = totals[i] < 0;
          el(svg, 'text', { x: x(totals[i]) + (below ? -6 : 6), y: y0 + inner / 2, dy: '0.35em', 'text-anchor': below ? 'end' : 'start', class: 'value' }, tick(totals[i]));
        }
      });
      watch(svg, function (i) {
        marker.setAttribute('visibility', i < 0 ? 'hidden' : 'visible');
        if (i >= 0) marker.setAttribute('y', positions[i] - pitch / 2);
      }, function (i) { return [width * 0.6, positions[i] + pitch / 2]; }, function (_, py) { return nearest(py); });
    }

    function nearest(at) {
      var best = 0;
      positions.forEach(function (p, i) { if (Math.abs(p - at) < Math.abs(positions[best] - at)) best = i; });
      return best;
    }

    var show = function () {};
    function watch(svg, mark, place, find) {
      show = function (i, speak) {
        if (i === active && !speak) return;
        active = i;
        mark(i);
        tip.hidden = i < 0;
        if (i < 0) return;
        tip.textContent = '';
        div(tip, 'at', spec.labels[i]);
        var said = [];
        spec.series.forEach(function (s, k) {
          var row = div(tip, 'row');
          if (spec.series.length > 1) div(row, 'key s' + (k + 1));
          var value = s.values[i] === null ? 'No data' : withUnit(s.values[i]);
          div(row, 'num', value);
          div(row, 'name', s.name);
          said.push(s.name + ' ' + value);
        });
        if (speak) live.textContent = spec.labels[i] + ': ' + said.join(', ');
        var at = place(i);
        var w = tip.offsetWidth;
        var x = spec.type === 'bar' ? at[0] : at[0] + 14 + w > width ? at[0] - 14 - w : at[0] + 14;
        tip.style.left = Math.max(0, Math.min(width - w, x)) + 'px';
        tip.style.top = at[1] + 4 + 'px';
      };
      var move = function (event) {
        var box = svg.getBoundingClientRect();
        show(find(event.clientX - box.left, event.clientY - box.top));
      };
      svg.addEventListener('pointermove', move);
      svg.addEventListener('pointerdown', move);
    }
    plot.addEventListener('pointerleave', function () { show(-1); });
    plot.addEventListener('blur', function () { show(-1); });
    plot.addEventListener('keydown', function (event) {
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (event.key === 'Escape') return show(-1);
      if (!step && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      var next = event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : active < 0 ? (step > 0 ? 0 : n - 1) : active + step;
      show(Math.max(0, Math.min(n - 1, next)), true);
    });

    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    if (window.ResizeObserver) new ResizeObserver(function () { if (plot.clientWidth !== width) draw(); }).observe(plot);
  }
  document.querySelectorAll('figure.chart').forEach(chart);
})();
