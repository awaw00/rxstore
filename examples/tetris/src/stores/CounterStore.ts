import { ActionType, AsyncActionType, asyncTypeDef, effect, ofType, RxStore, typeDef } from '@awaw00/rxstore';
import { of } from 'rxjs';
import { delay, map, mapTo, switchMap, withLatestFrom } from 'rxjs/operators';
import { postConstruct } from 'inversify';

export interface CounterState {
  count: number;
}

export class CounterStore extends RxStore<CounterState> {
  @typeDef() public INCREASE!: ActionType;
  @typeDef() public DOUBLE_INCREASE!: ActionType;

  @asyncTypeDef() public DOUBLE_ASYNC!: AsyncActionType;

  public increase = (count: number) => ({
    type: this.INCREASE,
    payload: count,
  });

  public doubleIncrease = () => ({
    type: this.DOUBLE_INCREASE,
  });

  public asyncDouble = (after: number) => ({
    type: this.DOUBLE_ASYNC.START,
    payload: {
      after,
    },
  });

  @postConstruct()
  private storeInit () {
    this.init({
      initialState: {
        count: 0,
      },
      reducer: (state, {type, payload}) => {
        switch (type) {
          case this.INCREASE:
            return {...state, count: state.count + payload};
          default:
            return state;
        }
      },
    });
  }

  @effect()
  private onDoubleIncrease () {
    return this.action$.pipe(
      ofType(this.DOUBLE_INCREASE),
      withLatestFrom(this.state$, (action, state) => state.count),
      map((count: number) => this.increase(count)),
    );
  }

  @effect()
  private onAsyncDouble () {
    return this.action$.pipe(
      ofType(this.DOUBLE_ASYNC.START),
      switchMap((action) => of(action).pipe(
        delay(action.payload.after),
        mapTo(this.doubleIncrease()),
      )),
    );
  }
}
