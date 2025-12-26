const TEXT_ELEMENT = 'TEXT_ELEMENT';
export const Fragment = Symbol('Fragment');

export function createElement(type, props, ...children) {
  const normalizedChildren = (children || []).flat().map((child) =>
    typeof child === 'object'
      ? child
      : createTextElement(child == null ? '' : child)
  );

  return {
    type,
    props: {
      ...(props || {}),
      children: normalizedChildren,
    },
  };
}

function createTextElement(text) {
  return {
    type: TEXT_ELEMENT,
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

function createDom(fiber) {
  const dom =
    fiber.type === TEXT_ELEMENT
      ? document.createTextNode('')
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);
  return dom;
}

const isEvent = (key) => key.startsWith('on');
const isProperty = (key) =>
  key !== 'children' && key !== 'style' && key !== 'key' && !isEvent(key);
const isNew = (prev, next) => (key) => prev[key] !== next[key];
const isGone = (prev, next) => (key) => !(key in next);

function updateDom(dom, prevProps, nextProps) {
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      if (name === 'className') {
        dom.removeAttribute('class');
      } else if (name in dom) {
        dom[name] = '';
      } else {
        dom.removeAttribute(name);
      }
    });

  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const value = nextProps[name];
      if (name === 'className') {
        dom.setAttribute('class', value || '');
      } else if (name === 'style' && value && typeof value === 'object') {
        Object.assign(dom.style, value);
      } else if (name in dom) {
        dom[name] = value;
      } else {
        dom.setAttribute(name, value);
      }
    });

  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

let nextUnitOfWork = null;
let wipRoot = null;
let currentRoot = null;
let deletions = null;
let wipFiber = null;
let hookIndex = 0;
const pendingEffects = [];

export function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

const schedule =
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb) =>
        setTimeout(() => {
          cb({
            timeRemaining: () => 0,
          });
        }, 1);

function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
  schedule(workLoop);
}

schedule(workLoop);

function performUnitOfWork(fiber) {
  const isFunctionComponent = typeof fiber.type === 'function';
  const isFragment = fiber.type === Fragment;

  if (isFunctionComponent) {
    wipFiber = fiber;
    hookIndex = 0;
    wipFiber.hooks = [];
    const children = [fiber.type(fiber.props)];
    reconcileChildren(fiber, children);
  } else if (isFragment) {
    fiber.dom = fiber.dom || null;
    reconcileChildren(fiber, fiber.props.children || []);
  } else {
    if (!fiber.dom) {
      fiber.dom = createDom(fiber);
    }
    reconcileChildren(fiber, fiber.props.children || []);
  }

  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
  return null;
}

function reconcileChildren(wipFiberNode, elements) {
  let index = 0;
  let oldFiber = wipFiberNode.alternate && wipFiberNode.alternate.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber) {
    const element = elements[index];
    let newFiber = null;

    const sameType =
      oldFiber && element && element.type === oldFiber.type;

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiberNode,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      };
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiberNode,
        alternate: null,
        effectTag: 'PLACEMENT',
      };
    }
    if (oldFiber && !sameType) {
      oldFiber.effectTag = 'DELETION';
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (newFiber) {
      if (index === 0) {
        wipFiberNode.child = newFiber;
      } else {
        prevSibling.sibling = newFiber;
      }
      prevSibling = newFiber;
    }
    index++;
  }
}

function commitRoot() {
  deletions.forEach(commitDeletion);
  commitWork(wipRoot.child);
  flushEffects();
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  let domParentFiber = fiber.parent;
  while (domParentFiber && !domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber ? domParentFiber.dom : null;

  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    domParent && domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === 'DELETION') {
    commitDeletion(fiber, domParent);
    return;
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  cleanupHooks(fiber);
  if (fiber.dom) {
    domParent && domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

function cleanupHooks(fiber) {
  if (fiber.hooks) {
    fiber.hooks.forEach((hook) => {
      if (typeof hook.cleanup === 'function') {
        hook.cleanup();
        hook.cleanup = undefined;
      }
    });
  }
  if (fiber.child) {
    cleanupHooks(fiber.child);
  }
  if (fiber.sibling) {
    cleanupHooks(fiber.sibling);
  }
}

export function useState(initial) {
  const oldHook =
    wipFiber &&
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  const actions = oldHook ? oldHook.queue : [];
  actions.forEach((action) => {
    hook.state = typeof action === 'function' ? action(hook.state) : action;
  });

  const setState = (action) => {
    hook.queue.push(action);
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}

export function useEffect(effect, deps) {
  const oldHook =
    wipFiber &&
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hasChanged =
    !oldHook ||
    !deps ||
    deps.some((dep, i) => !Object.is(dep, oldHook.deps ? oldHook.deps[i] : undefined));

  const hook = {
    deps,
    effect,
    cleanup: oldHook && oldHook.cleanup,
    hasChanged,
  };

  if (hasChanged) {
    pendingEffects.push(hook);
  }

  wipFiber.hooks.push(hook);
  hookIndex++;
}

function flushEffects() {
  while (pendingEffects.length > 0) {
    const hook = pendingEffects.shift();
    if (typeof hook.cleanup === 'function') {
      hook.cleanup();
    }
    const cleanup = hook.effect();
    if (typeof cleanup === 'function') {
      hook.cleanup = cleanup;
    }
  }
}

const ReactLike = {
  createElement,
  Fragment,
  useState,
  useEffect,
  render,
};

export default ReactLike;
