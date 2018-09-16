import { Container } from 'inversify';
import { Action, tokens } from '@awaw00/rxstore';
import { Subject } from 'rxjs';
import { CounterStore } from '../stores/CounterStore';

const container = new Container();

const action$ = new Subject<Action>();

container.bind(tokens.ActionStream).toConstantValue(action$);

container.bind(CounterStore).toSelf().inSingletonScope();

export {
  container,
};
