rxstore
----

[![Build Status](https://travis-ci.org/awaw00/react-inject-props.svg?branch=master)](https://travis-ci.org/awaw00/rxstore)
[![npm version](https://badge.fury.io/js/%40awaw00%2Frxstore.svg)](https://badge.fury.io/js/%40awaw00%2Frxstore)
[![Dependency Status](https://david-dm.org/awaw00/rxstore.svg)](https://david-dm.org/awaw00/rxstore)

OOP style reactive state manage solution.

OOP风格的响应式状态管理方案。

## 💾 Installation

`npm i @awaw00/rxstore inversify --save`

or

`yarn add @awaw00/rxstore inversify`

you should install the "reflect-metadata" package as well:

`npm i reflect-metadata --save` or `yarn add reflect-metadata`

## 🚀 Features

- ✅ 类似redux，但是模块化的状态容器
- ✅ 强大的inversif依赖注入支持
- ✅ 使用rxjs管理状态以及处理副作用

## 🚩 Usage Guide

### 准备工作

下面将以[TypeScript-React-Starter](https://github.com/Microsoft/TypeScript-React-Starter)为起点，简单说明如何使用rxstore。

rxstore的store与store之间是相互独立的，但是**各store发出的action会在同一个“管道”（action流）中进行传输**，在定义store之前，我们需要先配置一个action管道。

在rxstore的底层，各store会通过依赖注入系统注入这个action管道。熟悉inversify的同学应该也了解，我们的项目会包含一个统一处理依赖关系的文件，我们将这个文件定为`src/ioc/index.ts`，然后编写如下代码：

```typescript
import { Container } from 'inversify';
import { Subject } from 'rxjs';
import { Action, tokens } from '@awaw00/rxstore';

const container = new Container();

container.bind(tokens.ActionStream).toConstantValue(new Subject<Action>());

export {
  container
};
```

上面的代码中，初始化了一个Subject作为action的管道，并使用rxstore暴露出来的tokens将其绑定到了container中。

### 定义State接口

新建文件`src/stores/CounterStore.ts`，我们开始进行Store的编写。

编写store的第一步，就是思考store中需要保存什么结构的状态了，然后将其定义为一个state接口：

```typescript
export interface CounterState {
  count: number;
}
```

### 编写Store类

有了状态接口之后，就可以着手编写store的实现了。

首先，定义一个继承于RxStore的类，并将`CounterState`作为泛型参数传入：

```typescript
import { RxStore } from '@awaw00/rxstore';

export interface CounterState {
  count: number;
}

export class CounterStore extends RxStore<CounterState> {
  
}
```

接着，可以为store定义actionType了。

使用rxstore提供的`typeDef`和`asyncTypeDef`装饰器，可以方便又优雅地定义actionType：

```typescript
import { RxStore, typeDef, asyncTypeDef, ActionType, AsyncActionType } from '@awaw00/rxstore';


export class CounterStore extends RxStore<CounterState> {
  @typeDef() public INCREASE!: ActionType;
  @typeDef() public DOUBLE_INCREASE!: ActionType;
  
  @asyncTypeDef() public DOUBLE_ASYNC!: AsyncActionType;
}
```

上面定义了3个type：两个ActionType以及一个AsyncActionType。

在基类RxStore的构造方法中，会对使用了`typeDef`以及`asyncTypeDef`装饰器的字段进行自动赋值，比如`this.INCREASE`会被赋值为`Symbol('INCREASE')`，而`this.DOUBLE_ASYNC`会被赋值为：

```typescript
INCREASE_ASYNC = {
  START: Symbol('DOUBLE_ASYNC/START'),
  END: Symbol('DOUBLE_ASYNC/END'),
  ERR: Symbol('DOUBLE_ASYNC/ERR'),
}
```

然后我们需要使用`this.init`方法，设置store的initialState以及reducer：

```typescript
import { postConstruct } from 'inversify';
...
export class CounterStore extends RxStore<CounterState> {
  @postConstruct()
  private storeInit () {
    this.init({
      initialState: {
        count: 0
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
}
```

> 为什么要使用postConstructor装饰器？  
>
> rxstore提倡使用inversify管理依赖关系，如果你的store使用了property inject的方式来注入外部依赖，在store的构造方法结束前，inversify并不能为你准备好这些依赖对象。  
>
> 使用postConstructor可以确保所有依赖都已就绪后再执行store的初始化操作。

最后，还需要为store定义处理副作用的effects，以及action creators：

```typescript
import { effect, ofType } from '@awaw00/rxstore';
import { withLatestFrom, mapTo, of, switchMap } from 'rxjs/operators';

export class CounterStore extends RxStore<CounterState> {
  ...
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
```

### 绑定store

完成store的实现之后，不要忘记在container绑定store：

`src/ioc/index.ts`

```typescript
import { CounterStore } from '../stores/CounterStore';
...
container.bind(CounterStore).toSelf().inSingletonScope();
...
```

### 使用store

完成了counter store的编写后，就可以开始获取并使用store了。

新增Counter组件`src/components/Counter.tsx`，并编写如下代码：

```typescript
iimport React from 'react';
 import { CounterState, CounterStore } from '../stores/CounterStore';
 
 interface Props {
   store: CounterStore;
 }
 
 export class Counter extends React.Component<Props, CounterState> {
   private readonly subscription: { unsubscribe: () => any };
 
   constructor (props: Props) {
     super(props);
 
     this.subscription = props.store.state$.subscribe(state => {
       if (this.state) {
         this.setState(state);
       } else {
         this.state = state;
       }
     });
   }
 
   public componentWillUnmount () {
     // 不要忘记移除监听
     this.subscription.unsubscribe();
   }
 
   public increase = () => {
     const {store} = this.props;
     store.dispatch(store.increase(1));
   };
 
   public doubleIncrease = () => {
     const {store} = this.props;
     store.dispatch(store.doubleIncrease());
   };
 
   public asyncDouble = () => {
     const {store} = this.props;
     store.dispatch(store.asyncDouble(2000));
   };
 
   public render () {
     const {count} = this.state;
     return (
       <div>
         <p>Counter: {count}</p>
         <p>
           <button onClick={this.increase}>INCREASE</button>
           <button onClick={this.doubleIncrease}>DOUBLE</button>
           <button onClick={this.asyncDouble}>DOUBLE ASYNC</button>
         </p>
       </div>
     );
   }
 }
```

在`src/App.tsx`中，获取store并传入Counter组件：

```typescript
import * as React from 'react';
import { container } from './ioc';
import { CounterStore } from './stores/CounterStore';
import { Counter } from './components/Counter';

const store = container.get(CounterStore);

class App extends React.Component {
  public render() {
    return (
      <div className="App">
        <Counter store={store}/>
      </div>
    );
  }
}

export default App;
```

启动App，大功告成！

查看[在线DEMO](https://awaw00.github.io/rxstore/counter/)，查看[完整代码](https://github.com/awaw00/rxstore/tree/master/examples/counter)。
