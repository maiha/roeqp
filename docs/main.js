class DiffRatio {
  diff;
  ratio;

  constructor(obj, diff) {
    if (obj.constructor.name == 'DiffRatio') {
      this.ratio = obj.ratio
      this.diff = obj.diff
    } else {
      this.ratio = obj
      this.diff = diff || DiffRatio.Diff.Nop
    }
  }
}

DiffRatio.Diff = {
  Nop: 'nop',
  Add: 'add',
  Del: 'del',
}

// 特殊効果のレート情報
class EffectRatio {
  name; // "固定詠唱"
  val;  // 50 
  max;  // 100
  unit; // "%"
  pct;  // 50 

  static default_max = 100

  constructor(name, val, max, unit) {
    this.name = name
    this.val  = val
    this.max  = max || EffectRatio.default_max
    this.unit = unit
    this.pct  = Math.min(100, Math.trunc(this.val * 100 / this.max))
  }

  copy = function(opts) {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this, opts)
  }

  serialize = function() {
    return EffectRatio.serialize(this)
  }

  pretty_pct = function() {
    return EffectRatio.pretty_pct(this)
  }

  val_with_unit = function() {
    return `${this.val}${this.unit}`
  }

  static regexp_source  = '^%(\\d+)(/(\\d+))?(.?)\\[([^\\]\n]*?)\\]'
  static scan_regexp    = new RegExp(EffectRatio.regexp_source, 'gmu')
  static unapply_regexp = new RegExp(EffectRatio.regexp_source, 'u')

  /*
  ```js
  "%50[固定詠唱]と\n%100[石化耐性]が欲しい".match(/^%(\d+)\[([^\]\n]*?)\]/gmu)
  // => (2) ['%50[固定詠唱]', '%100[石化耐性]']
  ```
  */
  static scan = function(text) {
    const ratios = []
    const match = text.match(EffectRatio.scan_regexp)

    match?.forEach(full => { // "%50[固定詠唱]"
      const ratio = EffectRatio.deserialize(full)
      if (ratio) {
        console.debug(ratio)
        ratios.push(ratio)
      }
    })

    return ratios
  }

  static pretty_pct = function(v) {
    let den = ''
    if (v.max != EffectRatio.default_max) den += v.max.toString()
    if (den.length > 0) den = `/${den}`
    return `${v.val}${den}${v.unit}`
  }

  static serialize = function(v) {
    return `%${EffectRatio.pretty_pct(v)}[${v.name}]`
  }

  static deserialize = function(v) {
    const md = v.match(EffectRatio.unapply_regexp)
    if (md) {
      console.debug(md)
      // ['%50/80%[固定詠唱]', '50', '/80', '80', '%', '固定詠唱', index: 0, input: '%50/80%[固定詠唱]'
      // ['%20/30[全ステ+]', '20', '/30', '30', '', '全ステ+', index: 0, input: '%20/30[全ステ+]'
      // ['%79%[ディレイ]', '79', undefined, undefined, '%', 'ディレイ', index: 0, input: '%79%[ディレイ]'
      const name  = md[5] // '固定詠唱'
      const val   = Number(md[1]) // 50
      const max   = Number(md[3]) || 100 // 80
      const unit  = md[4] || ''  // '%'
      const ratio = new EffectRatio(name, val, max, unit)
      console.log(ratio)
      return ratio
    } else {
      return null
    }
  }
}

class Inventory {
  static CSS = {
    data: 'ROEQP-data',
    invt: 'ROEQP-invt',
    smpl: 'ROEQP-invt-smpl',
    view: 'ROEQP-invt-view',
    bars: 'ROEQP-invt-bars',
    form: 'ROEQP-invt-form',
    grid: 'ROEQP-invt-view-grid',
    flex: 'ROEQP-invt-flex',
  }

  invt;
  view;
  smpl;
  bars;
  form;
  grids;
  textarea;
  items = [];
  ratios = [];
  comments = [];
  opts = {
    normalize_source: true,
    source: null,
    placeholder: "",
  };

  used_pos = {}

  constructor(root, items, opts) {
    this.items = items || []
    this.opts  = Object.assign(this.opts, opts || {})

    this.invt  = this.construct_invt(root)
    this.smpl  = this.construct_smpl()
    this.view  = this.construct_view()
    this.bars  = this.construct_bars()
    this.form  = this.construct_form()
    this.grids = [...Array(10).keys()].map(pos => this.construct_grid(pos))
  }

  update(opts) {
    opts ??= {}
    if (opts.source) this.opts.source = opts.source
    if (this.opts.source) this.textarea?.val(this.opts.source)
    const source = this.textarea?.val() || ''

    this.ratios = EffectRatio.scan(source)
    this.items = Roeqp.scan(source)
    this.comments = source.match(/^\s*(# .*?)$/mg)?.map(i => i.trim()) || []
    this.render()
  }

  render() {
    this.render_smpl()
    this.render_bars(this.ratios)

    if (this.opts.normalize_source) {
      let text = ''
      if (this.ratios.length > 0) {
        this.ratios.forEach(ratio => text += `${ratio.serialize()}\n`)
        text += "\n"
      }
      this.items.forEach(item => text += `${item.label()}\n`)
      text += "\n"
      this.comments.forEach(comment => text += `${comment}\n`)
      this.textarea.val(text) 
    }

    for (let pos=0; pos<10; pos++)
      this.render_grid(pos);

    const used_pos = {}
    this.items.forEach(item => {
      console.debug(item)
      let pos = item.pos
      if (pos == 45) {
        if (!used_pos[4]) {
          pos = 4
        } else if (!used_pos[5]) {
          pos = 5
        } else {
          pos = 4
        }
      }
      if (pos == 89) {
        if (!used_pos[8]) {
          pos = 8
        } else if (!used_pos[9]) {
          pos = 9
        } else {
          pos = 8
        }
      }
      used_pos[pos] = item
      this.render_grid(pos, item);
    });
    this.used_pos = used_pos // render_trimで使う。独立で呼ばれるのでキャッシュしておく

    this.render_trim()
  }

  render_trim() {
    let view_height = 500
    if (ROEQP.opts.invt_style == 'real' && ROEQP.opts.view_trim) {
      view_height = 0
      for (const [pos, value] of Object.entries(this.used_pos)) {
        const grid = this.view.find(`.grid-${pos}`)
        const top  = parseInt(grid.css('top'), 10)
        const height = parseInt(grid.css('height'), 10)
        const y = top + height
        if (Number.isInteger(y)) {
          view_height = Math.max(view_height, y)
        }
      }
      console.debug(`trim: max height to [${view_height}]`)
    }
    this.view.css('height', `${view_height}px`)
  }

  render_bars(ratios) {
    const table = $('<table>', {class: "bar"})
    console.debug(ratios)
    const diff_ratios = ratios.map(v => new DiffRatio(v))
    $.each(diff_ratios, (idx, diff_ratio) => {
      const diff  = diff_ratio.diff
      const ratio = diff_ratio.ratio
      const rank = Math.trunc(ratio.pct / 25.0) * 25
    
      // <div class="name">固定詠唱</div>
      const label = $('<div>', {class: "name", text: ratio.name})
      // <progress value="70" max="100"></progress><span>70 %</span>
      //const progress = $('<progress>', {class: `progress rank-${rank}`, value: ratio.pct, max: ratio.max})
      const progress = $('<div>', {class: `progress rank-${rank}`})
      progress.append($('<div>', {class: 'bar', width: `${ratio.pct}%`}))
      const percent  = $('<span>', {class: "percent", text: ratio.val_with_unit()})

      const tr = $('<tr>', {class: `rank-${rank} diff-${diff}`})
      tr.append($('<td>', {class: "label"}).append(label))
      tr.append($('<td>', {class: "progress"}).append(progress))
      tr.append($('<td>', {class: "percent"}).append(percent))
      table.append(tr)
    })

    this.bars.empty()
    this.bars.append(table)
  }

  render_smpl() {
    if (ROEQP.opts.smpl) {
      this.smpl.show()
    } else {
      this.smpl.hide()
    }
  }

  render_grid(pos, item) {
    const grid = this.grids[pos]
    if (!grid) {
      console.error(`ROEQP: no grids[${pos}]`, item)
      return
    }
    grid.empty()

    if (item) {
      grid.append($('<img>', {class: "icon", src: `https://rotool.gungho.jp/images/item/${item.id}.png`}))
      grid.append($('<div>', {class: "name", text: item.label()}))
    }
  }

  // root
  construct_invt(root) {
    const css = Inventory.CSS
    root.addClass(`${css.invt} invt`)
    return root
  }

  construct_smpl() {
    const invt = this
    const css = Inventory.CSS
    const div = $('<div>', {class: `${css.smpl} smpl`})

    // <button type="button" onclick="$('.source').text('...')">猫</button>
    $.each(Object(this.opts.samples), (name, text) => {
      const button = $('<button>', {type: "button", text: name})
      const source = text.replace(/^\s+/mg,'').trim()
      button.click(() => { invt.update({source: source}) })
      div.append(button)
    })

    this.invt.append(div)
    return div
  }

  // root -> bars
  construct_bars() {
    const css = Inventory.CSS
    const el = this.invt.find(`.${css.bars}`)
    if (el.length > 0) {
      return el
    } else {
      /*
        <div class="ROEQP-invt-bars bars">
        </div>
      */
      const div = $('<div>', {class: `${css.flex} ${css.bars} bars`})
      this.invt.append(div)
      console.debug(`ROEQP: [#${this.invt.attr("id")}.${css}] is not found. generated.`)
      return div
    }
  }

  // root -> form
  construct_form() {
    const invt = this
    const css = Inventory.CSS
    const el = this.invt.find(`.${css.form}`)
    if (el.length > 0) {
      return el
    } else {
      const div = $('<div>', {class: `${css.flex} ${css.form} form`})
      /*
        <div class="ROEQP-invt-form form">
          <button type="button" onclick="$('.source').text('...')">猫</button>
          <textarea name="source" rows="20"></textarea>
          <button type="button" onclick="ROEQP.scan(...)">読み込み</button>
        </div>
      */

      // <textarea name="source" rows="20"></textarea>
      const placeholder = String(this.opts.placeholder).replace(/^\s+/mg,'').trim()
      const source = this.opts.source ?? this.source_from_samples()
      const textarea = $('<textarea>', {name: "source", width: '100%', rows: 20, text: source, placeholder: placeholder})

      // <button type="button" onclick="ROEQP.scan(...)">再描画</button>
      const button = $('<button>', {type: "button", text: "再描画"})
      button.click(() => { invt.update({source: textarea.val()}) })

      div.append(textarea).append(button)
      this.invt.append(div)
      this.textarea = textarea
      console.debug(`ROEQP: [#${this.invt.attr("id")}.${css}] is not found. generated.`)
      return div
    }
  }

  source_from_samples() {
    const samples = this.opts.samples
    try {
      if (samples.constructor == Object) {
        return Object.values(this.opts.samples)[0].toString()
      }
    } catch(e) {
      console.error(e)
    }
    return ""
  }

  // root -> view
  construct_view() {
    const css = Inventory.CSS
    const el = this.invt.find(`.${css.view}`)
    if (el.length > 0) {
      return el
    } else {
      const div = $('<div>', {class: `${css.view} view`})
      this.invt.append(div)
      console.debug(`ROEQP: [#${this.invt.attr("id")}${css}] is not found. generated.`)
      return div
    }
  }

  // root -> view -> grid
  construct_grid(pos) {
    const css = Inventory.CSS.grid
    const el = this.view.find(`.grid-${pos}`)
    if (el.length > 0) {
      return el
    } else {
      const div = $('<div>', {class: `${css} grid grid-${pos}`})
      this.view.append(div)
      console.debug(`ROEQP: [#${this.invt.attr("id")}.${css}, ${pos}] is not found. generated.`)
      return div
    }
  }
}

ROEQP = function() {}

// 全体オプション(ページ管理)
ROEQP.opts = {
  invt_style: 'real', // 表示形式
  view_name: true, // 装備名の表示
  view_trim: true, // 余白詰め
  smpl: true, // サンプル
  bars: true, // %表示
  form: true, // 入力フォーム
}

ROEQP.render_opts = function(o = ROEQP.opts) {
  $('#ROEQP-c-view-trim').prop('checked', o.view_trim)
  $('#ROEQP-c-view-name').prop('checked', o.view_name)
  $('#ROEQP-c-smpl').prop('checked', o.smpl)
  $('#ROEQP-c-bars').prop('checked', o.bars)
  $('#ROEQP-c-form').prop('checked', o.form)
}

ROEQP.invts = []
ROEQP.activate_opts = {}

ROEQP.render = function() {
  ROEQP.invts.forEach(invt => invt.render())
}

ROEQP.activate = function(target, opts) {
  opts = Object.assign({}, ROEQP.activate_opts, opts || {})
  $(target).each(function(index) {
    const root = $(this)
    ROEQP.change_invt_style(root)
    const invt = new Inventory(root, [], opts)
    if (opts.update) invt.update()
    ROEQP.invts.push(invt)
  })

  // add event handlers
  const css = Inventory.CSS

  $(document).on('change', '#ROEQP-c-smpl', function(){
    ROEQP.opts.smpl = $(this).prop('checked')
    ROEQP.invts.forEach(invt => invt.render())
  });

  $(document).on('change', '#ROEQP-c-view-trim', function(){
    ROEQP.opts.view_trim = $(this).prop('checked')
    ROEQP.invts.forEach(invt => invt.render_trim())
  });

  $(document).on('change', '#ROEQP-c-view-name', function(){
    ROEQP.opts.view_name = $(this).prop('checked')
    const value = ROEQP.opts.view_name ? "block" : "none"
    $(`.${css.view} .name`).css("display", value)
  });
  $(document).on('change', '#ROEQP-c-bars', function(){
    const key = `.${css.bars}`
    const checked = $(this).prop('checked')
    if (checked) {
      $(key).show()
    } else {
      $(key).hide()
    }
  });
  $(document).on('change', '#ROEQP-c-form', function(){
    const key = `.${css.form}`
    const checked = $(this).prop('checked')
    if (checked) {
      $(key).show()
    } else {
      $(key).hide()
    }
  });
}

ROEQP.change_invt_style = function(target, name = 'real') {
  const key = Inventory.CSS.invt
  const val = `${Inventory.CSS.view}-${name}`
  target ??= $(`.${key}`)
  target.removeClass().addClass(`${key} ${val}`)
};

ROEQP.Align = {
  Right: '右',
  Bottom: '下',
};

ROEQP.change_align = function(value) {
  const css = Inventory.CSS
  const key = `.${css.flex}`
  switch (value) {
    case ROEQP.Align.Right:  $(key).css("float", "left"); break
    case ROEQP.Align.Bottom: $(key).css("float", "none"); break
  }
};

ROEQP.change_margin = function(value) {
  const css = Inventory.CSS
  $(`.${css.invt}`).css("margin", value)
};

ROEQP.Frame = {
  Box: '外',
  All: '全',
  None: 'なし',
}
ROEQP.set_frame = function(value) {
  const css = Inventory.CSS
  let box = false
  let item = false
  switch (value) {
    case ROEQP.Frame.Box:  box = true; break
    case ROEQP.Frame.All:  box = true; item = true; break
    case ROEQP.Frame.None: break
  }
  console.debug("set_frame", value, box, item)
  $(`.${css.view}`).css("border-width", box ? "1px" : "0")
  $(`.${css.view} .grid`).css("border-width", item ? "1px" : "0")
};

ROEQP.read_samples = function(root) {
  const samples = {}
  $(root).find('.sample').each(function(index){
    const el = $(this)
    const label = String(el.data('label'))
    let sample = String(el.text()).replace(/^\s+/mg,'').trim()
    const source = el.data("source")
    if (source && source.match(/^http/)) sample += `\n# ${source}\n`
    console.debug("read_samples", label, sample)
    if (label && sample) {
      samples[label] = sample
    }
  })
  return samples
}

ROEQP.changelog = function(root, limit) {
  const label = $(root).find('.label')
  const data  = $(root).find('.data')
  const text  = data.text().replace(/^\s+/mg,'').trim()
  const tip   = text.split(/\n/).slice(0, limit).join("\n")
  label.addClass("qtip tip-right")
  label.attr("data-tip", tip)
  label.click(() => { data.toggle() })
}

ROEQP.scan = function(text, invt) {
  if (invt) {
    invt.update(Roeqp.scan(text))
  } else {
    console.error(`ROEQP: no elements found named [${key}]`)
  }
}

ROEQP.chara2_mode = function() {
  const invts = $(`.${Inventory.CSS.invt}`)
  if (invts.length == 1) {
    const opts = {source: ''}
    const div = $('<div>')
    $('#ROEQP-data').append(div)
    ROEQP.activate(div, opts)
    ROEQP.change_align(ROEQP.Align.Bottom)
  }
}

ROEQP.diff = function() {
  ROEQP.chara2_mode()

  const invt1 = ROEQP.invts[0]
  const invt2 = ROEQP.invts[1]
  const ratios1 = invt1.ratios
  const ratios2 = invt2.ratios
  const hash2 = {}
  const new_ratios2 = []

  ratios2.forEach(i => hash2[i.name] = i)

  ratios1.forEach( r1 => {
    const key = r1.name
    const r2 = hash2[key]
    if (r2) {
      // r1, r2 の両方にある
      delete hash2[key]
      if (r1.val > r2.val) {
        new_ratios2.push(new DiffRatio(r2, DiffRatio.Diff.Del))
      } else if (r1.val < r2.val) {
        new_ratios2.push(new DiffRatio(r2, DiffRatio.Diff.Add))
      } else {
        new_ratios2.push(new DiffRatio(r2, DiffRatio.Diff.Nop))
      }
    } else {
      // r1 にだけある
      const r = new EffectRatio(key, 0, r1.max, r1.unit)
      new_ratios2.push(new DiffRatio(r, DiffRatio.Diff.Del))
    }
  })

  // r2 にだけある
  for (const [key, r2] of Object.entries(hash2)) {
    new_ratios2.push(new DiffRatio(r2, DiffRatio.Diff.Add))
  }
  
  invt2.render_bars(new_ratios2)
}
