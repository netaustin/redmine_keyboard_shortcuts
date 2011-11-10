var ks_dispatcher, store;

document.observe("dom:loaded", function() {
  store = new CookieJar({expires: 86400, path: '/'});
  ks_dispatcher = new KsDispatcher();
});

var KsDispatcher = Class.create({

  initialize: function() {
    this.ks_managers = []
    this.dialog = null;
    if ($$('table.list').length == 1) {
      this.ks_managers.push(new KsListManager());
    }
    else if ($$('body.controller-issues.action-show').length == 1) {
      this.ks_managers.push(new KsIssueManager());
    }
    else if ($$('body.controller-issue_moves.action-new').length == 1) {
      this.ks_managers.push(new KsMoveManager());
    }

    this.ks_managers.push(new KsGlobalManager());

    document.observe('keypress', this.keypress.bindAsEventListener(this));

    // special case for escape key
    document.observe('keydown', this.keydown.bindAsEventListener(this));
  },

  keydown: function(event) {
    if (event.which == 27) {
      if (this.dialog) {
        this.closeDialog();
      }
      if (document.activeElement) {
        document.activeElement.blur();
      }
    }
  },

  keypress: function(event) {
    // ignore keypress in elements
    var element;
    if (event.target) element = event.target;
    else if (event.srcElement) element = event.srcElement;
    if (element.nodeType==3) element = element.parentNode;
    if (element.tagName == 'INPUT' || element.tagName == 'TEXTAREA') return;

    var key_pressed = String.fromCharCode(event.keyCode);

    // dispatch to shortcut manager
    this.ks_managers.each(function(ksm) {
      if ('keys' in ksm && key_pressed in ksm.keys) {
        if (this.dialog) {
          if (!('allowInDialog' in ksm.keys[key_pressed]) || ksm.keys[key_pressed].allowInDialog == false) {
            return;
          }
        }
        ksm.keys[key_pressed].press(event);
        return false;
      }
    });
  },

  createDialog: function() {
    if (this.dialog) {
      return false;
    }
    this.dialog = new KsDialog();
    return this.dialog;
  },

  closeDialog: function() {
    this.dialog.close();
    this.dialog = null;
  },

  go: function(url) {
    if (!url.match(/^http/) && !url.match(/^\//)) {
      url = '/' + url;
    }
    document.location.href = url;
  }

});

var KsGlobalManager = Class.create({

  initialize: function() {
    this.description = "Global Keyboard Shortcuts";

    this.keys = {
      p: {
        press: this.changeProject.bind(this),
        description: "Switch to new project"
      },
      n: {
        press: this.newIssue.bind(this),
        description: "Create a new issue"
      },
      i: {
        press: this.viewAllIssues.bind(this),
        description: "View all issues for current project"
      },
      h: {
        press: this.viewHelp.bind(this),
        description: "See all available shortcuts",
        allowInDialog: true
      }
    };
  },

  changeProject: function() {
    var dialog = ks_dispatcher.createDialog();
    dialog.title.update('Navigate to a different project');
    var form = new Element('form', {id: 'project-selector-form'});
    var selector = new Element('select', {id: 'project-selector'});
    selector.insert(new Element('option', {value: ''}).update('Choose a project...'));
    ks_projects.each(function(project) {
      var option = new Element('option', {value: project.identifier});
      option.update(project.name);
      selector.insert(option);
    });
    dialog.body.insert(form.insert(selector).insert(new Element('input', {type: 'submit', value: 'Go'})));
    $('project-selector').focus();
    $('project-selector-form').observe('submit', this.projectSelectorChanged.bind(this));
    // $('project-selector').observe('change', this.projectSelectorChanged.bind(this));
    dialog.fixPosition();
  },

  projectSelectorChanged: function(event) {
    Event.stop(event);
    var val = $('project-selector').getValue();
    if (val != '') {
      ks_dispatcher.go('projects/' + val);
    }
  },

  newIssue: function() {
    var new_issue_link = $$('.new-issue');
    if (new_issue_link.length > 0) {
      ks_dispatcher.go(new_issue_link[0].href);
    }
  },

  viewAllIssues: function() {
    var issues_link = $$('.issues');
    if (issues_link.length > 0) {
      ks_dispatcher.go(issues_link[0].href);
    }
  },

  viewHelp: function() {
    if (ks_dispatcher.dialog && $$('.ks-help').length > 0) {
      ks_dispatcher.closeDialog();
      return;
    }
    var dialog = ks_dispatcher.createDialog();
    dialog.title.update('Keyboard Shortcuts');
    ks_dispatcher.ks_managers.each(function(ksm) {
      dialog.body.insert(new Element('h4').update(ksm.description));
      var table = new Element('table', {class: 'ks-help'});
      for (var j in ksm.keys) {
        var tr = new Element('tr');
        var key_td = new Element('td', {class: 'key'}).update(j);
        var value_td = new Element('td').update(ksm.keys[j].description);
        tr.insert(key_td).insert(value_td);
        table.insert(tr);
      }
      dialog.body.insert(table);
    });
    dialog.fixPosition();
  }

});

var KsListManager = Class.create({

  initialize: function() {
    this.issues = $$('.list.issues tr.issue');
    this.current_selected = 0;
    this.chosen = [];
    this.selectIssue(0);

    this.description = "Keyboard Shortcuts for List View";

    this.keys = {
      j: {
        press: this.nextIssue.bind(this),
        description: "Move cursor to next issue"
      },
      k: {
        press: this.previousIssue.bind(this),
        description: "Move cursor to previous issue"
      },
      x: {
        press: this.clickCurrentIssue.bind(this),
        description: "Check the box of the issue under the cursor"
      },
      X: {
        press: this.selectOrUnselectAll.bind(this),
        description: "Toggle checkboxes for all issues in current view off or on"
      },
      m: {
        press: this.move.bind(this),
        description: "Move all currently selected issues"
      },
      e: {
        press: this.edit.bind(this),
        description: "Edit all currently selected issues"
      },
      o: {
        press: this.open.bind(this),
        description: "Open the issue under the cursor"
      }
    };

    if (checked_issues = store.get('checked_issues')) {
      this.setSelectedIds(checked_issues);
    }

    this.rememberIssues(this.getAllIds());

  },

  selectIssue: function(idx) {
    if (this.current_selected != idx) {
      this.issues[this.current_selected].removeClassName('ks-selected');
    }
    this.issues[idx].addClassName('ks-selected');
    this.current_selected = idx;
  },

  selectIssueByRedmineId: function(rmid) {
    $('issue-' + rmid).down('.checkbox input').click();
  },

  setSelectedIds: function(ids) {
    ids.each(function(id) {
      this.selectIssueByRedmineId(id);
    }, this);
  },

  selectOrUnselectAll: function() {
    var is_checked = false;
    this.issues.each(function(el) {
      if (el.down('.checkbox input').checked) {
        is_checked = true;
        return false;
      }
    });

    if (is_checked) {
      this.toggleAll('off');
    }
    else {
      this.toggleAll('on');
    }
  },

  toggleAll: function(state) {
    var check_state = (state == 'off');
    this.issues.each(function(el) {
      var checkbox = el.down('.checkbox input');
      if (checkbox.checked == check_state) {
        checkbox.click();
      }
    });
  },

  previousIssue: function() {
    if (this.current_selected > 0) {
      this.selectIssue(this.current_selected - 1);
    }
  },

  nextIssue: function() {
    if (this.current_selected != this.issues.length -1) {
      this.selectIssue(this.current_selected + 1);
    }
  },

  clickCurrentIssue: function() {
    this.issues[this.current_selected].down('.checkbox input').click();
    store.put('checked_issues', this.getChosenIds());
  },

  getChosenIds: function() {
    var ids = [];
    this.issues.each(function(el) {
      var checkbox = el.down('.checkbox input');
      if (checkbox.checked) {
        ids.push(checkbox.getValue());
      }
    });
    return ids;
  },

  getTitleById: function(id) {
    return $('issue-' + id).down('td.subject a').innerHTML;
  },

  rememberIssues: function(ids) {
    var issues = [];
    ids.each(function(id, index) {
      issues.push({id: id, title: this.getTitleById(id)});
    }, this);
    store.put('issue_queue', issues);
  },

  getAllIds: function() {
    var ids = [];
    this.issues.each(function(el) {
      ids.push(el.id.replace('issue-', ''));
    });
    return ids;
  },

  getIdString: function() {
    var str = [];
    this.getChosenIds().each(function(id) {
      str.push('ids[]=' + id);
    });
    return str.join('&');
  },

  move: function() {
    if (this.getChosenIds().length > 0) {
      ks_dispatcher.go('issues/move/new?' + this.getIdString());
    }
  },

  edit: function() {
    var ids = this.getChosenIds();
    if (ids.length == 1) {
      ks_dispatcher.go('issues/' + ids[0] + '/edit');
    }
    else if (ids.length > 1) {
      ks_dispatcher.go('issues/bulk_edit?' + this.getIdString());
    }
  },

  open: function() {
    var cur_id = this.issues[this.current_selected].id.replace('issue-', '');
    ks_dispatcher.go('issues/' + cur_id);
  },

});

var KsIssueManager = Class.create({

  initialize: function() {
    this.description = "Keyboard Shortcuts for Issue View";
    this.keys = {
      j: {
        press: this.nextIssue.bind(this),
        description: "Navigate to next issue",
        allowInDialog: true
      },
      k: {
        press: this.previousIssue.bind(this),
        description: "Navigate to previous issues",
        allowInDialog: true
      },
      e: {
        press: this.editIssue.bind(this),
        description: "Edit current issue"
      },
      l: {
        press: this.viewQueue.bind(this),
        description: "View and navigate issue list",
        allowInDialog: true
      },
      o: {
        press: this.openIssue.bind(this),
        description: "Open selected issue in list",
        allowInDialog: true
      },
      a: {
        press: this.assignIssue.bind(this),
        description: "Assign this issue"
      },
      s: {
        press: this.saveIssue.bind(this),
        description: "Save the issue"
      }
    };
    this.issue_queue = store.get('issue_queue');
    this.issue_id = ks_issue_id;
    this.previous = this.next = null;
    if (this.issue_queue) {
      this.issue_queue.each(function(issue, i) {
        if (issue.id == this.issue_id) {
          if (i > 0) {
            this.previous = this.issue_queue[i - 1];
          }
          if (i < this.issue_queue.length - 1) {
            this.next = this.issue_queue[i + 1];
          }
        }
      }, this);
    }
    else {
      this.keys.j = null;
      this.keys.k = null;
    }
    this.has_edited = false;
    this.issue_list = [];
  },

  nextIssue: function() {
    if (this.inQueue() && this.current_selected != this.issue_list.length -1) {
      this.selectIssue(this.current_selected + 1);
    }
    else if(this.next) {
      ks_dispatcher.go('/issues/' + this.next.id);
    }
  },

  previousIssue: function() {
    if (this.inQueue() && this.current_selected > 0) {
      this.selectIssue(this.current_selected - 1);
    }
    else if(this.previous) {
      ks_dispatcher.go('/issues/' + this.previous.id);
    }
  },

  selectIssue: function(idx) {
    if (this.current_selected != idx) {
      this.issue_list[this.current_selected].removeClassName('selected');
    }
    this.issue_list[idx].addClassName('selected');
    this.current_selected = idx;
  },

  openIssue: function() {
    if (this.inQueue()) {
      ks_dispatcher.go(this.issue_list[this.current_selected].down('a').readAttribute('href'));
    }
  },

  editIssue: function(event) {
    this.has_edited = true;
    showAndScrollTo("update", "notes");
    Event.stop(event);
  },

  assignIssue: function(event) {
    if (!this.has_edited) {
      this.editIssue(event);
    }
    $('issue_assigned_to_id').focus();
  },
  
  saveIssue: function(event) {
    if (!this.has_edited) {
      this.editIssue(event);
    }
    $('issue-form').submit();
  },

  inQueue: function() {
    return ($$('.ks-list').length > 0);
  },

  viewQueue: function() {
    if (ks_dispatcher.dialog && $$('.ks-list').length > 0) {
      ks_dispatcher.closeDialog();
      return;
    }
    var dialog = ks_dispatcher.createDialog();
    dialog.title.update('Issue Queue');
    var list = new Element('ul', {class: 'ks-list'});
    var i = 0;
    this.current_selected = 0;
    this.issue_queue.each(function(issue) {
      var list_item = new Element('li');
      var link = new Element('a').writeAttribute('href', '/issues/' + issue.id).update(issue.title);
      if (this.issue_id == issue.id) {
        list_item.addClassName('selected');
        this.current_selected = i;
      }
      list_item.update(link);
      list.insert(list_item);
      i++;
    }, this);
    var help = "j and k to move up and down, o to open";
    dialog.body.insert(new Element('p', {class: 'ks-list-description'}).update(help));
    dialog.body.insert(list);
    dialog.fixPosition();
    this.issue_list = $$('.ks-list li');
  }

});

var KsMoveManager = Class.create({

  initialize: function() {
    this.description = "Keyboard Shortcuts for Bulk Issue Mover";
    this.keys = {
      m: {
        press: this.changeProject.bind(this),
        description: "Change project",
      },
      a: {
        press: this.assignIssues.bind(this),
        description: "Change assignee",
        allowInDialog: true
      },
      s: {
        press: this.saveForm.bind(this),
        description: "Move Issues"
      }
    };
  },
  
  changeProject: function() {
    $('new_project_id').focus();
  },
  
  assignIssues: function() {
    $('assigned_to_id').focus();
  },
  
  saveForm: function() {
    $('move_form').submit();
  }
});

var KsDialog = Class.create({

  initialize: function() {
    var dialog = new Element('div', {id: 'dialog-wrapper'}).insert(
      new Element('div', {id: 'dialog'}).insert(
        new Element('h3', {id: 'dialog-title'})
      ).insert(
        new Element('div', {id: 'dialog-body'})
      )
    );
    $$('body')[0].insert({top: dialog});

    this.dialog = $('dialog');
    this.title = $('dialog-title');
    this.body = $('dialog-body');

    $('dialog-wrapper').observe('click', function(event) {
      if (event.target.id == 'dialog-wrapper') {
        ks_dispatcher.closeDialog();
      }
    });
    this.fixPosition();
    document.observe('scroll', this.fixPosition.bind(this));
    Event.observe(window, 'resize', this.fixPosition.bind(this));
  },

  fixPosition: function() {
    var window_height = document.viewport.getHeight();
    var margin = (window_height - this.dialog.getHeight()) / 2;
    this.dialog.setStyle({
      'margin-top': Math.round(document.viewport.getScrollOffsets().top + margin) + 'px',
    });
  },

  close: function() {
    $('dialog-wrapper').remove();
  }

});