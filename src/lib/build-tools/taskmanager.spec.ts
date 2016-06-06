/// <reference path='../third_party/typings/browser.d.ts' />

import TaskManager = require('./taskmanager');
import Manager = TaskManager.Manager;

describe('TaskManager', function() {
  var taskManager :Manager;

  it('New task manager has no tasks', function() {
    taskManager = new Manager();
    expect(taskManager.list()).toEqual([]);
  });

  it('Adding a 3 tasks (A,B,AB) with subtasks gives 3 top-level tasks',
      function() {
    taskManager.add('A', ['t1','t2','t3','t4']);
    taskManager.add('B', ['t1','t5','t3','t6','t4']);
    taskManager.add('AB', ['A','B']);
    expect(taskManager.list()).toEqual(['A','B','AB']);
  });

  it('Get AB drops duplicated tasks but preserves task ordering', function() {
    expect(taskManager.get('AB')).toEqual(['t1','t2','t3','t4','t5','t6']);
  });

  it('GetUnflattened AB still gives origianl task definition', function() {
    expect(taskManager.getUnflattened('AB')).toEqual(['A', 'B']);
  });

  it('Task A still has its original tasks', function() {
    expect(taskManager.getUnflattened('A')).toEqual(['t1','t2','t3','t4']);
  });

  it('Task B still has its original tasks', function() {
    expect(taskManager.getUnflattened('B'))
      .toEqual(['t1','t5','t3','t6','t4']);
  });

  it('Task A and B have a cycle', function() {
    taskManager = new Manager();
    taskManager.add('A', ['a1','a2','B','a4']);
    expect(() => { taskManager.add('B', ['b1','b2','A','b4']); }).toThrow();
  });

  it('Task A is self-cyclic', function() {
    taskManager = new Manager();
    expect(() => { taskManager.add('A', ['a1','a2','A','a4']); }).toThrow();
  });

});  // describe('TaskManager', ... )
