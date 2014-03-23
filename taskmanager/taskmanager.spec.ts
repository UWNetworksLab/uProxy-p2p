/// <reference path='../../third_party/DefinitelyTyped/jasmine/jasmine.d.ts' />
/// <reference path='taskmanager.d.ts' />

module TaskManager {

  describe("TaskManager", function() {
    var taskManager;

    it("New task manager has no tasks", function() {
      taskManager = new Manager();
      expect(taskManager.list()).toEqual([]);
    });

    it("Adding a 3 tasks (A,B,AB) with subtasks gives 3 top-level tasks",
        function() {
      taskManager.add('A', ['t1','t2','t3','t4']);
      taskManager.add('B', ['t1','t5','t3','t6','t4']);
      taskManager.add('AB', ['A','B']);
      expect(taskManager.list()).toEqual(['A','B','AB']);
    });

    it("Get AB drops duplicated tasks but preserves task ordering", function() {
      expect(taskManager.get('AB')).toEqual(['t1','t2','t3','t4','t5','t6']);
    });

    it("GetUnflattened AB still gives origianl task definition", function() {
      expect(taskManager.getUnflattened('AB')).toEqual(['A', 'B']);
    });

    it("Task A still has it's original tasks", function() {
      expect(taskManager.getUnflattened('A')).toEqual(['t1','t2','t3','t4']);
    });

    it("Task B still has it's original tasks", function() {
      expect(taskManager.getUnflattened('B'))
        .toEqual(['t1','t5','t3','t6','t4']);
    });

});  // describe("TaskManager", ... )

}  // module TaskManager
