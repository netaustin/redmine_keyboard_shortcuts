/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
(function(){
  var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
  this.Class = function(){};
  Class.extend = function(prop) {
    var _super = this.prototype;
    initializing = true;
    var prototype = new this();
    initializing = false;
    for (var name in prop) {
      prototype[name] = typeof prop[name] == "function" &&
        typeof _super[name] == "function" && fnTest.test(prop[name]) ?
        (function(name, fn){
          return function() {
            var tmp = this._super;
            this._super = _super[name];
            var ret = fn.apply(this, arguments);        
            this._super = tmp;
            return ret;
          };
        })(name, prop[name]) :
        prop[name];
    }
    function Class() {
      if ( !initializing && this.init )
        this.init.apply(this, arguments);
    }
    Class.prototype = prototype;
    Class.prototype.constructor = Class;
    Class.extend = arguments.callee;
   
    return Class;
  };
})();

var ks_dispatcher, store;
$.cookie.json = true;

$(document).ready(function() {
  ks_dispatcher = new KsDispatcher();
});

var KsDispatcher = Class.extend({

  init: function() {
    this.ks_managers = []
    this.dialog = null;
    if ($('body.controller-issues.action-show').length == 1) {
      this.ks_managers.push(new KsIssueManager());
    }
    else if ($('body.controller-issues.action-bulk_edit').length == 1) {
      this.ks_managers.push(new KsEditManager());
    }
    else if ($('table.list').length == 1) {
      this.ks_managers.push(new KsListManager());
    }

    this.ks_managers.push(new KsGlobalManager());

    var self = this;
    $(document).on('keypress', function(e) {
      self.keypress(e);
    });

    // special case for escape key
    $(document).on('keydown', function(e) {
      self.keydown(e);
    });
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
    if (element.tagName == 'INPUT' || element.tagName == 'TEXTAREA' || element.tagName == 'SELECT' || element.tagName == 'OPTION') return;

    var key_pressed = getDisplayKey(event);

    // dispatch to shortcut manager
    $.each(this.ks_managers, function(i, ksm) {
      if ('keys' in ksm && key_pressed in ksm.keys && ksm.keys[key_pressed]) {
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

var KsGlobalManager = Class.extend({

  init: function() {
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

  changeProject: function(e) {
    e.preventDefault();
    var dialog = ks_dispatcher.createDialog();
    dialog.title.html('Navigate to a different project');
    form = '<p>Choose a project:</p>';
    form += '<input type="text" id="project-selector" size="40" />';
    dialog.body.append(form);
    var self = this;
    $('#project-selector').autocomplete({
      source: function(req, resp) {
        var matches = [];
        $.each(ks_projects, function(i, project) {
          if (project.project.identifier.indexOf(req.term) !== -1 || project.project.name.indexOf(req.term) !== -1) {
            matches.push({label: project.project.name, value: project.project.identifier});
          }
        });
        resp(matches);
      },
      close: function() {
        self.selectorChange();
      }
    });
    $('#project-selector').focus();
    $('#project-selector').on('keyup', function(e) {
      if (e.which != 40 && e.which != 38 && e.which != 13) self.selectorChange();
    });
    dialog.fixPosition();
  },

  selectorChange: function() {
    var choice = $('#project-selector').val();
    $.each(ks_projects, function(i, project) {
      if (project.project.identifier == choice) {
        ks_dispatcher.go('projects/' + choice);
      }
    });
  },

  newIssue: function() {
    var new_issue_link = $('.new-issue');
    if (new_issue_link.length > 0) {
      ks_dispatcher.go(new_issue_link.attr('href'));
    }
  },

  viewAllIssues: function() {
    var issues_link = $('.issues');
    if (issues_link.length > 0) {
      ks_dispatcher.go(issues_link.attr('href'));
    }
  },

  viewHelp: function() {
    if (ks_dispatcher.dialog && $('.ks-help').length > 0) {
      ks_dispatcher.closeDialog();
      return;
    }
    var dialog = ks_dispatcher.createDialog();
    dialog.title.html('Keyboard Shortcuts');
    $.each(ks_dispatcher.ks_managers, function(i, ksm) {
      dialog.body.append($('<h4></h4>').html(ksm.description));
      var help = '<table class="ks-help">';
      for (var j in ksm.keys) {
        if (ksm.keys[j]) {
          help += '<tr><td class="key">' + j + '</td><td>' + ksm.keys[j].description + '</td></tr>';
        }
      }
      help += '</table>';
      dialog.body.append(help);
    });
    dialog.fixPosition();
  }

});

var KsListManager = Class.extend({

  init: function() {
    this.issues = $('.list.issues tr.issue');
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
      e: {
        press: this.edit.bind(this),
        description: "Edit all currently selected issues"
      },
      o: {
        press: this.open.bind(this),
        description: "Open the issue under the cursor"
      }
    };

    if (checked_issues = $.cookie('checked_issues')) {
      this.setSelectedIds(checked_issues);
    }

    this.rememberIssues(this.getAllIds());

  },

  selectIssue: function(idx) {
    if (this.current_selected != idx) {
      $(this.issues[this.current_selected]).removeClass('ks-selected');
    }
    $(this.issues[idx]).addClass('ks-selected');
    this.current_selected = idx;
  },

  selectIssueByRedmineId: function(rmid) {
    if ($('#issue' + rmid)) {
      $('#issue-' + rmid).find('.checkbox input').click();
    }
  },

  setSelectedIds: function(ids) {
    var self = this;
    $.each(ids, function(i, id) {
      self.selectIssueByRedmineId(id);
    });
  },

  selectOrUnselectAll: function() {
    var is_checked = false;
    this.issues.each(function(el) {
      if ($(this).find('.checkbox input').is(':checked')) {
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
      var checkbox = $(this).find('.checkbox input');
      if ($(checkbox).is(':checked') == check_state) {
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
    $(this.issues[this.current_selected]).find('.checkbox input').click();
    $.cookie('checked_issues', this.getChosenIds(), {path: '/'});
  },

  getChosenIds: function() {
    var ids = [];
    this.issues.each(function() {
      var checkbox = $(this).find('.checkbox input');
      if ($(checkbox).is(':checked')) {
        ids.push($(checkbox).val());
      }
    });
    return ids;
  },

  getTitleById: function(id) {
    return $('#issue-' + id).find('td.subject a').text();
  },

  rememberIssues: function(ids) {
    var issues = [];
    var self = this;
    $.each(ids, function(i, curid) {
      issues.push({id: curid, title: self.getTitleById(curid)});
    });
    $.cookie('issue_queue', issues, {path: '/'});
  },

  getAllIds: function() {
    var ids = [];
    $.each(this.issues, function(i, el) {
      ids.push(el.id.replace('issue-', ''));
    });
    return ids;
  },

  getIdString: function() {
    var str = [];
    $.each(this.getChosenIds(), function(i, id) {
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

var KsIssueManager = Class.extend({

  init: function() {
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
      w: {
        press: this.saveIssue.bind(this),
        description: "Save the issue"
      },
      s: {
        press: this.setStatus.bind(this),
        description: "Set Status"
      }
    };
    this.issue_queue = $.cookie('issue_queue');
    this.issue_id = ks_issue_id;
    this.previous = this.next = null;
    if (this.issue_queue) {
      var self = this;
      $.each(this.issue_queue, function(i, issue) {
        if (issue.id == self.issue_id) {
          if (i > 0) {
            self.previous = self.issue_queue[i - 1];
          }
          if (i < self.issue_queue.length - 1) {
            self.next = self.issue_queue[i + 1];
          }
        }
      });
    }
    else {
      this.issue_queue = [];
      this.keys.j = null;
      this.keys.k = null;
      this.keys.l = null;
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
      $(this.issue_list[this.current_selected]).removeClass('selected');
    }
    $(this.issue_list[idx]).addClass('selected');
    this.current_selected = idx;
  },

  openIssue: function() {
    if (this.inQueue()) {
      ks_dispatcher.go($(this.issue_list[this.current_selected]).find('a').attr('href'));
    }
  },

  editIssue: function(event) {
    this.has_edited = true;
    showAndScrollTo("update", "notes");
    window.location.hash = "notes";
    event.preventDefault();
  },

  assignIssue: function(event) {
    if (!this.has_edited) {
      this.editIssue(event);
    }
    window.location.hash = "issue_assigned_to_id";
    $('#issue_assigned_to_id').focus();
  },

  saveIssue: function(event) {
    if (!this.has_edited) {
      this.editIssue(event);
    }
    $('#issue-form').submit();
  },

  setStatus: function(event) {
    if (!this.has_edited) {
      this.editIssue(event);
    }
    window.location.hash = "issue_status_id";
    $('#issue_status_id').focus();
  },

  inQueue: function() {
    return ($('.ks-list').length > 0);
  },

  viewQueue: function() {
    if (ks_dispatcher.dialog && $('.ks-list').length > 0) {
      ks_dispatcher.closeDialog();
      return;
    }
    var dialog = ks_dispatcher.createDialog();
    dialog.title.html('Issue Queue');
    var list = $('<ul class="ks-list"><ul>');
    var i = 0;
    this.current_selected = 0;
    $.each(this.issue_queue, function(i, issue) {
      var li = $('<li></li>');
      if (this.issue_id == issue.id) {
        li.addClass('selected');
        this.current_selected = i;
      }
      li.html('<a href="' + '/issues/' + issue.id + '">' + issue.title + '</a>');
      list.append(li);
      i++;
    });
    var help = "<p>j and k to move up and down, o to open</p>";
    dialog.body.append(help);
    dialog.body.append(list);
    dialog.fixPosition();
    this.issue_list = $('.ks-list li');
  }

});

var KsEditManager = Class.extend({

  init: function() {
    this.description = "Keyboard Shortcuts for Bulk Issue Editor";
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
    $('#issue_project_id').focus();
  },

  assignIssues: function() {
    $('#issue_assigned_to_id').focus();
  },

  saveForm: function() {
    $('#bulk_edit_form').submit();
  }
});

var KsDialog = Class.extend({

  init: function() {
    var dialog = '<div id="dialog-wrapper"><div id="dialog"><h3 id="dialog-title"></h3><div id="dialog-body"></div></div></div>';
    $('body').prepend(dialog);

    this.dialog = $('#dialog');
    this.title = $('#dialog-title');
    this.body = $('#dialog-body');

    $('dialog-wrapper').on('click', function(event) {
      if (event.target.id == 'dialog-wrapper') {
        ks_dispatcher.closeDialog();
      }
    });
    this.fixPosition();
    var self = this;
    $(document).on('scroll', function() { self.fixPosition(); });
    $(window).on('resize', function() { self.fixPosition(); });
  },

  fixPosition: function() {
    var window_height = $(window).height();
    var margin = $(window).scrollTop() + (window_height - this.dialog.height()) / 2;
    this.dialog.css({
      'margin-top': margin + 'px',
    });
  },

  close: function() {
    $('#dialog-wrapper').remove();
  }

});

var getDisplayKey = function(e) {
  if (e.keyCode) keycode = e.keyCode;
  else keycode = e.which;
  return String.fromCharCode(keycode);
}
