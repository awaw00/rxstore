import { Container, inject, injectable, postConstruct } from 'inversify';
import { ActionStream, ActionType, AsyncActionType, asyncTypeDef, RxStore, typeDef } from './index';
import { expect } from 'chai';
import { combineLatest, Subject } from 'rxjs';
import { map, skip } from 'rxjs/operators';

describe('Test', () => {
  let rootContainer: Container;
  beforeEach(() => {
    rootContainer = new Container();
    rootContainer.bind(ActionStream).toConstantValue(new Subject());
  });

  afterEach(() => {
  });

  it('Should typeDef and asyncTypeDef work', () => {
    class Store extends RxStore<any> {
      @typeDef public TYPE!: ActionType;
      @asyncTypeDef public ASYNC_TYPE!: AsyncActionType;

      public constructor () {
        super();
      }
    }

    const store = new Store();

    expect(store.TYPE).is.not.eq(void 0);
    expect(store.ASYNC_TYPE).is.not.eq(void 0);
    expect(typeof store.TYPE).is.eq('symbol');
    expect(typeof store.ASYNC_TYPE.START).is.eq('symbol');
    expect(typeof store.ASYNC_TYPE.END).is.eq('symbol');
    expect(typeof store.ASYNC_TYPE.END).is.eq('symbol');
  });
  it('Store combination', (done) => {
    interface ChildState {
      name: string;
      age: number;
    }

    interface ParentState {
      parentName: string;
      child: ChildState;
    }

    @injectable()
    class ChildStore extends RxStore<ChildState> {
      @typeDef public CHANGE_AGE!: ActionType;

      @postConstruct()
      private storeInit () {
        this.init({
          initialState: {
            name: 'child',
            age: 10
          },
          reducer: (state, action) => {
            switch (action.type) {
              case this.CHANGE_AGE:
                return {...state, age: 20};
            }

            return state;
          }
        });
      }
    }

    @injectable()
    class ParentStore extends RxStore<ParentState> {

      @inject(ChildStore)
      private childStore!: ChildStore;

      @postConstruct()
      private storeInit () {
        this.init({
          initialState: {
            parentName: 'parent',
            child: this.childStore.options.initialState
          },
          reducer: (state, action) => {
            return state;
          }
        });

        this.state$ = combineLatest(
          this.state$,
          childStore.state$
        ).pipe(
          map(([thisState, childState]) => {
            return {
              ...thisState,
              child: childState
            };
          })
        );
      }
    }

    rootContainer.bind(ChildStore).toSelf().inSingletonScope();
    rootContainer.bind(ParentStore).toSelf().inSingletonScope();

    const childStore = rootContainer.get(ChildStore);
    const parentStore = rootContainer.get(ParentStore);

    parentStore.state$.pipe(
      skip(1)
    ).subscribe(state => {
      expect(state.child.age).to.eq(20);
      done();
    });

    childStore.dispatch({type: childStore.CHANGE_AGE});
  });
});
