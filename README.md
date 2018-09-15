rxstore
----

[![Build Status](https://travis-ci.org/awaw00/react-inject-props.svg?branch=master)](https://travis-ci.org/awaw00/rxstore)
[![npm version](https://badge.fury.io/js/%40awaw00%2Frxstore.svg)](https://badge.fury.io/js/%40awaw00%2Frxstore)
[![Dependency Status](https://david-dm.org/awaw00/rxstore.svg)](https://david-dm.org/awaw00/rxstore)

OOP style reactive state manage solution.

## 💾 Installation

`npm i @awaw00/rxstore inversify --save`

or

`yarn add @awaw00/rxstore inversify`

with typescript, you should install the "reflect-metadata" package as well:

`npm i reflect-metadata --save` or `yarn add reflect-metadata`

## ▶ Usage

### Store definition

```typescript
import { tap } from 'rxjs/operators';
import { RxStore, effect, typeDef, asyncTypeDef, ofType, end, ActionType, AsyncActionType } from '@awaw00/rxstore';
import { injectable, postConstruct } from "inversify";

export interface ModalState {
  open: boolean;
  title: string;
  contentLoading: boolean;
  submitting: boolean;
}

@injectable()
export class ModalStore extends RxStore<ModalState> {
  @typeDef() public OPEN!: ActionType;
  @asyncTypeDef() public GET_DATA!: AsyncActionType;

  public open () {
    this.dispatch({type: this.OPEN});
  }

  // store mast has a function decroatored with postConstruct for init store
  @postConstruct()
  private storeInit () {
    this.init({
      initialState: {
        open: false,
        title: '',
        contentLoading: false,
        submitting: false
      },
      reducer: (state, action) => {
        switch (action.type) {
          case this.OPEN:
            return {...state, open: true};
        }
        return state;
      }
    });
  }
  
  // define effects with effect decorator
  @effect()
  private onOpen () {
    return this.action$.pipe(
      ofType(this.OPEN),
      tap(() => console.log('modal opened')),
    );
  }
}
```

### Use with react, and react-inject-props

```typescript
import React from 'react';
import { Container } from 'inversify';
import { Modal, Spin, Button } from 'antd';
import { createPropsDecorators } from 'react-inject-props';

const rootContainer = new Container();
const {InjectProps, ProvideProps} = createPropsDecorators(rootContainer);

interface AppProps {
  modalStore?: ModalStore;
}
interface AppState {
  modalState: ModalState;
}

@ProvideProps([
  {provide: ModalStore, useClass: ModalStore, singleton: false}
])
@InjectProps({
  modalStore: ModalStore
})
class App extends React.Component<AppProps, AppState> {
  constructor (props) {
    super(props);
    
    props.modalStore!.state$.subscribe(modalState => {
      if (!this.state) {
        this.state = {modalState};
      } else {
        this.setState({modalState});
      }
    });
  }
  render () {
    const {modalState} = this.state;
    const {modalStore} = this.props;
    return (
      <div>
        <Modal title={modalState.title} visible={modalState.open} ...>
          <Spin spinning={modalState.loading}>
            ...
          </Spin>
        </Modal>
        
        <Button onClick={modalStore!.open}>Open Modal</Button>
      </div>
    );
  }
}
```
