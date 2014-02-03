


  //-------------------------------------------------------------------------
  //


  var tasks;
  function add_task(taskname, subtasks) {
    expanded_tasks =
    subtasks
    tasks[taskname]
  }

interface gruntFileObj {
  cwd ?: string;
  src : string[];
}

module Tasks {

  function dedup(a) {
    a.filter(function (v, i, a) { return a.indexOf (v) == i });
  }

  function srcsOfFile(file : gruntFileObj) {
    var srcs = [];
    var cwd = file.cwd + '/' || '';
    files.map(function(file) {
      file.src.map(function(s) { srcs.push(cwd + s); });
    });
    return srcs;
  }

  class Task {
    id : string;

    // identifiers of subtasks, flattened.
    subtasks : string[] = [];

    // minimatch style list specifying files this task depends on.
    srcs : string[] = [];

    addSrcs(srcs : string[]) { this.srcs += srcs; }
    setSrcs(srcs : string[]) { this.srcs = srcs; }
    addGruntFile(file : gruntFileObj) {
      this.addSrcs(this.srcsOfFile(file));
    }
  }

  export class Manager {
    tasks : taskId[] = [];

    addTask(name : string, subtasks : string[], srcs : )
  }

}
