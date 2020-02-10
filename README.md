# Universal Model for Angular

Universal model is a model which can be used with any of following UI frameworks:

- Angular 2+ 
- React 16.8+ [universal-model-react]
- Svelte 3+ [universal-model-svelte]
- Vue.js 3+ [universal-model-vue]

If you want to use multiple UI frameworks at the same time, you can use single model
with [universal-model] library

## Install

    npm install --save universal-model-angular

## Prerequisites for universal-model-react

     Angular >= 2

## Clean UI Architecture

![alt text](https://github.com/universal-model/universal-model-vue/raw/master/images/mvc.png 'MVC')

- Model-View-Controller (https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller)
- User triggers actions by using view or controller
- Actions are part of model and they manipulate state that is stored
- Actions can use services to interact with external (backend) systems
- State changes trigger view updates
- Selectors select and calculate a transformed version of state that causes view updates
- Views contain NO business logic
- There can be multiple interchangeable views that use same part of model
- A new view can be created to represent model differently without any changes to model
- View technology can be changed without changes to the model

## Clean UI Code directory layout
UI application is divided into UI components. Common UI components should be put into common directory. Each component
can consist of subcomponents. Each component has a view and optionally controller and model. Model consists of actions, state
and selectors. In large scale apps, model can contain sub-store. Application has one store which is composed of each components'
state (or sub-stores)

    - src
      |
      |- common
      |  |- component1
      |  |- component2
      |  .  |- component2_1
      |  .  .
      |  .  .
      |- componentA
      |- componentB
      |  |- componentB_1
      |  |- componentB_2
      |- componentC
      |  |- view
      |  .
      |  .
      |- componentN
      |  |- controller
      |  |- model
      |  |  |- actions
      |  |  |- services
      |  |  |- state
      |  |- view
      |- store


## API
    createSubState(subState);
    const store = createStore(initialState, combineSelectors(selectors))
    
    const { componentAState } = store.getState();
    const { selector1, selector2 } = store.getSelectors();
    const [{ componentAState }, { selector1, selector2 }] = store.getStateAndSelectors();
    
    useState(this, { componentAState });
    useSelectors(this, { selector1, selector2 });
    useStateAndSelectors(this, { componentAState }, { selector1, selector2 });
    
## API Examples
**Create initial states**

    const initialComponentAState = {
      prop1: 0,
      prop2: 0
    };
    
**Create selectors**

When using foreign state inside selectors, prefer creating foreign state selectors and accessing foreign
state through them instead of directly accessing foreign state inside selector. This will ensure  better
encapsulation of component state.

    const createComponentASelectors = <T extends State>() => ({
      selector1: (state: State) => state.componentAState.prop1  + state.componentAState.prop2
      selector2: (state: State) => {
        const { componentBSelector1, componentBSelector2 } = createComponentBSelectors<State>();
        return state.componentAState.prop1 + componentBSelector1(state) + componentBSelector2(state);
      }
    });

**Create and export store in store.ts:**

combineSelectors() checks if there are duplicate keys in selectors and will throw an error telling which key was duplicated.
By using combineSelectors you can keep your selector names short and only namespace them if needed.
    
    const initialState = {
      componentAState: createSubState(initialComponentAState),
      componentBState: createSubState(initialComponentBState)
    };
    
    export type State = typeof initialState;
    
    const componentAStateSelectors = createComponentAStateSelectors<State>();
    const componentBStateSelectors = createComponentBStateSelectors<State>();
    
    const selectors = combineSelectors<State, typeof componentAStateSelectors, typeof componentBStateSelectors>(
      componentAStateSelectors,
      componentBStateSelectors
    );
    
    export default createStore<State, typeof selectors>(initialState, selectors);
    
in large projects you should have sub-stores for components and these sub-store are combined 
together to a single store in store.js:

**componentBSubStore.js**

    export const initialComponentsBState = { 
      componentBState: createSubState(initialComponentBState),
      componentB_1State: createSubState(initialComponentB_1State),
      componentB_2State: createSubState(initialComponentB_2State),
    };
    
    const componentBStateSelectors = createComponentBStateSelectors<State>();
    const componentB_1StateSelectors = createComponentB_1StateSelectors<State>();
    const componentB_2StateSelectors = createComponentB_2Selectors<State>('componentB');
    
    const componentsBStateSelectors = combineSelectors<State, typeof componentBStateSelectors, typeof componentB_1StateSelectors, typeof componentB_2StateSelectors>(
      componentBStateSelectors,
      componentB_1StateSelectors,
      componentB_2StateSelectors
    );
    
**store.js**

    const initialState = {
      ...initialComponentsAState,
      ...initialComponentsBState,
      .
      ...initialComponentsNState
    };
          
    export type State = typeof initialState;
        
    const selectors = combineSelectors<State, typeof componentsAStateSelectors, typeof componentsBStateSelectors, ... typeof componentsNStateSelectors>(
      componentsAStateSelectors,
      componentsBStateSelectors,
      .
      componentsNStateSelectors
    );
        
    export default createStore<State, typeof selectors>(initialState, selectors);
    
**Access store in Actions**

Don't modify other component's state directly inside action, but instead 
call other component's action. This will ensure encapsulation of component's own state.

    export default function changeComponentAAndBState(newAValue, newBValue) {
      const { componentAState } = store.getState();
      componentAState.prop1 = newAValue;
      
      // BAD
      const { componentBState } = store.getState();
      componentBState.prop1 = newBValue;
      
      // GOOD
      changeComponentBState(newBValue);
    }

**Use actions, state and selectors in Views (Angular Components)**

Components should use only their own state and access other components' states using selectors
provided by those components. This will ensure encapsulation of each component's state.
    
    export default class AComponent {
      state: typeof initialComponentAState;
      selector1: string,
      selector2: number
      // Action
      changeComponentAState = changeComponentAState
      
      constructor() {
        const [{ componentAState }, { selector1, selector2 }] = store.getStateAndSelectors();
        useStateAndSelectors(this, { componentAState: state }, { selector1, selector2 });
      }
    }

# Example

## View
app.component.ts

    import { Component } from '@angular/core';
    
    @Component({
      selector: 'app-root',
      template: `
        <app-header-view></app-header-view>
        <app-todo-list-view></app-todo-list-view>
      `,
      styleUrls: []
    })
    export class AppComponent {}

header.component.ts

    import { Component } from '@angular/core';
    import initialHeaderState from '@/header/model/state/initialHeaderState';
    import changeUserName from '@/header/model/actions/changeUserName';
    import store from '@/store/store';
    
    @Component({
      selector: 'app-header-view',
      template: `
        <div>
          <h1>{{ headerText }}</h1>
          <label for="userName">User name:</label>
          <input #userNameInput id="userName" (change)="changeUserName(userNameInput.value)" />
        </div>
      `,
      styleUrls: []
    })
    export class HeaderComponent {
      headerText: string;
      changeUserName = changeUserName;
    
      constructor() {
        const { headerText } = store.getSelectors();
        store.useSelectors(this, { headerText });
      }
    }

todolist.component.ts

    import { Component, OnDestroy, OnInit } from '@angular/core';
    import initialTodosState, { Todo } from '@/todolist/model/state/initialTodosState';
    import toggleShouldShowOnlyDoneTodos from '@/todolist/model/actions/toggleShouldShowOnlyUnDoneTodos';
    import toggleIsDoneTodo from '@/todolist/model/actions/toggleIsDoneTodo';
    import removeTodo from '@/todolist/model/actions/removeTodo';
    import store from '@/store/store';
    import fetchTodos from '@/todolist/model/actions/fetchTodos';
    import todoListController from '@/todolist/controller/todoListController';
    
    @Component({
      selector: 'app-todo-list-view',
      template: `
        <div>
          <input
            id="shouldShowOnlyUnDoneTodos"
            type="checkbox"
            [checked]="todosState.shouldShowOnlyUnDoneTodos"
            (click)="toggleShouldShowOnlyUnDoneTodos()"
          />
          <label for="shouldShowOnlyUnDoneTodos">Show only undone todos</label>
          <div *ngIf="todosState.isFetchingTodos">Fetching todos...</div>
          <div *ngIf="todosState.hasTodosFetchFailure; else todoList">Failed to fetch todos</div>
          <ng-template #todoList>
            <ul>
              <li *ngFor="let todo of shownTodos">
                <input id="todo.name" type="checkbox" [checked]="todo.isDone" (click)="toggleIsDoneTodo(todo)" />
                <label for="todo.name">{{ userName }}: {{ todo.name }}</label>
                <button (click)="removeTodo(todo)">Remove</button>
              </li>
            </ul>
          </ng-template>
        </div>
      `,
      styleUrls: []
    })
    export class TodoListComponent implements OnInit, OnDestroy {
      todosState: typeof initialTodosState;
      shownTodos: Todo[];
      userName: string;
      toggleShouldShowOnlyUnDoneTodos = toggleShouldShowOnlyDoneTodos;
      toggleIsDoneTodo = toggleIsDoneTodo;
      removeTodo = removeTodo;
    
      constructor() {
        const [{ todosState }, { shownTodos, userName }] = store.getStateAndSelectors();
        store.useStateAndSelectors(this, { todosState }, { shownTodos, userName });
      }
    
      ngOnInit(): void {
        // noinspection JSIgnoredPromiseFromCall
        fetchTodos();
        document.addEventListener('keydown', todoListController.handleKeyDown);
      }
    
      ngOnDestroy(): void {
        document.removeEventListener('keydown', todoListController.handleKeyDown);
      }
    }

## Controller

todoListController.ts

    import addTodo from "@/todolist/model/actions/addTodo";
    import removeAllTodos from "@/todolist/model/actions/removeAllTodos";

    export default {
      handleKeyDown(keyboardEvent: KeyboardEvent): void {
        if (keyboardEvent.code === 'KeyA' && keyboardEvent.ctrlKey) {
          keyboardEvent.stopPropagation();
          keyboardEvent.preventDefault();
          addTodo();
        } else if (keyboardEvent.code === 'KeyR' && keyboardEvent.ctrlKey) {
           keyboardEvent.stopPropagation();
           keyboardEvent.preventDefault();
          removeAllTodos();
        }
      }
    };
    
## Model

### Store

store.ts

     import { combineSelectors, createStore, createSubState } from 'universal-model-angular';
     import initialHeaderState from '@/header/model/state/initialHeaderState';
     import initialTodoListState from '@/todolist/model/state/initialTodosState';
     import createTodoListStateSelectors from '@/todolist/model/state/createTodoListStateSelectors';
     import createHeaderStateSelectors from '@/header/model/state/createHeaderStateSelectors';
     
     const initialState = {
       headerState: createSubState(initialHeaderState),
       todosState: createSubState(initialTodoListState)
     };
     
     export type State = typeof initialState;
     
     const headerStateSelectors =  createHeaderStateSelectors<State>();
     const todoListStateSelectors = createTodoListStateSelectors<State>();
     
     const selectors = combineSelectors<State, typeof headerStateSelectors, typeof todoListStateSelectors>(
      headerStateSelectors,
      todoListStateSelectors 
     );
     
     export default createStore<State, typeof selectors>(initialState, selectors);

### State

#### Initial state

initialHeaderState.ts

    export default {
      userName: 'John'
    };

initialTodoListState.ts

    export interface Todo {
      id: number,
      name: string;
      isDone: boolean;
    }

    export default {
      todos: [] as Todo[],
      shouldShowOnlyUnDoneTodos: false,
      isFetchingTodos: false,
      hasTodosFetchFailure: false
    };

#### State selectors

createHeaderStateSelectors.ts

    import { State } from '@/store/store';
    
    const createHeaderStateSelectors = <T extends State>() => ({
      userName: (state: T) => state.headerState.userName,
      headerText: (state: T) => {
        const {
          todoCount: selectTodoCount,
          unDoneTodoCount: selectUnDoneTodoCount
        } = createTodoListStateSelectors<T>();
      
        return `${state.headerState.userName} (${selectUnDoneTodoCount(state)}/${selectTodoCount(state)})`;
      }
    });
    
    export default createHeaderStateSelectors;

createTodoListStateSelectors.ts

    import { State } from '@/store/store';
    import { Todo } from '@/todolist/model/state/initialTodoListState';

    const createTodoListStateSelectors = <T extends State>() => ({
      shownTodos: (state: T) =>
        state.todosState.todos.filter(
          (todo: Todo) =>
            (state.todosState.shouldShowOnlyUnDoneTodos && !todo.isDone) ||
            !state.todosState.shouldShowOnlyUnDoneTodos
        ),
        todoCount: (state: T) => state.todosState.todos.length,
        unDoneTodoCount: (state: T) => state.todosState.todos.filter((todo: Todo) => !todo.isDone).length
    });

    export default createTodoListStateSelectors;

### Service

ITodoService.ts

    import { Todo } from '@/todolist/model/state/initialTodoListState';

    export interface ITodoService {
      tryFetchTodos(): Promise<Todo[]>;
    }

FakeTodoService.ts

    import { ITodoService } from '@/todolist/model/services/ITodoService';
    import { Todo } from '@/todolist/model/state/initialTodoListState';
    import Constants from '@/Constants';
    
    export default class FakeTodoService implements ITodoService {
      tryFetchTodos(): Promise<Todo[]> {
        return new Promise<Todo[]>((resolve: (todo: Todo[]) => void, reject: () => void) => {
          setTimeout(() => {
            if (Math.random() < 0.95) {
              resolve([
                { id: 1, name: 'first todo', isDone: true },
                { id: 2, name: 'second todo', isDone: false }
              ]);
            } else {
              reject();
            }
          }, Constants.FAKE_SERVICE_LATENCY_IN_MILLIS);
        });
      }
    }

todoService.ts

    import FakeTodoService from "@/todolist/model/services/FakeTodoService";

    export default new FakeTodoService();

### Actions

changeUserName.ts

    import store from '@/store/store';
    
    export default function changeUserName(newUserName: string): void {
      const { headerState } = store.getState();
      headerState.userName = newUserName;
    }

addTodo.ts

    import store from '@/store/store';
    
    let id = 3;
    
    export default function addTodo(): void {
      const { todosState } = store.getState();
      todosState.todos.push({ id, name: 'new todo', isDone: false });
      id++;
    }

removeTodo.ts

    import store from '@/store/store';
    import { Todo } from '@/todolist/model/state/initialTodoListState';

    export default function removeTodo(todoToRemove: Todo): void {
      const { todosState } = store.getState();
      todosState.todos = todosState.todos.filter((todo: Todo) => todo !== todoToRemove);
    }

removeAllTodos.ts

    import store from '@/store/store';

    export default function removeAllTodos(): void {
      const { todosState } = store.getState();
      todosState.todos = [];
    }

toggleIsDoneTodo.ts

    import { Todo } from '@/todolist/model/state/initialTodoListState';

    export default function toggleIsDoneTodo(todo: Todo): void {
      todo.isDone = !todo.isDone;
    }

toggleShouldShowOnlyUnDoneTodos.ts

    import store from '@/store/store';

    export default function toggleShouldShowOnlyUnDoneTodos(): void {
      const { todosState } = store.getState();
      todosState.shouldShowOnlyUnDoneTodos = !todosState.shouldShowOnlyUnDoneTodos;
    }

fetchTodos.ts

    import store from '@/store/store';
    import todoService from '@/todolist/model/services/todoService';

    export default async function fetchTodos(): Promise<void> {
      const { todosState } = store.getState();

      todosState.isFetchingTodos = true;
      todosState.hasTodosFetchFailure = false;

      try {
        todosState.todos = await todoService.tryFetchTodos();
      } catch (error) {
        todosState.hasTodosFetchFailure = true;
      }

      todosState.isFetchingTodos = false;
    }

### Full Examples

https://github.com/universal-model/universal-model-angular-todo-app

https://github.com/universal-model/universal-model-react-todos-and-notes-app

### Dependency injection
If you would like to use dependency injection (noicejs) in your app, check out this [example],
where DI is used to create services.

### License

MIT License

[example]: https://github.com/universal-model/react-todo-app-with-dependency-injection
[universal-model-react]: https://github.com/universal-model/universal-model-react
[universal-model-svelte]: https://github.com/universal-model/universal-model-svelte
[universal-model-vue]: https://github.com/universal-model/universal-model-vue



