/**
 * Created by riggs on 6/30/16.
 */
"use strict";


let wrapper_window_origin = "chrome-extension://fpfmfigelfacjdeonglpnkgbilpbopdi";

let session = {
  log: {
    start: null,
    end: null,
    smiley: null,
    toilet: null,
    skull: null,
    dog: null,
    errors: []
  },
  id: null,
  configuration: null,
  metrics: null,
};
window.session = session;


function color (r, g, b, a=1) {
  let obj = {r: r, g: g, b: b, a: a};

  obj.toString = () => {
    return "rgba(" + obj.r + "," + obj.g + "," + obj.b + "," + obj.a + ")";
  };

  return obj;
}

const GREEN = color(0, 0x80, 0);
const RED = color(0xFF, 0, 0);
const BLACK = color(0, 0, 0);


let Display = {
  canvas: null,
  context: null,
  initialize: (canvas => {
    let context = Display.context || canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    Display.canvas = canvas;
    Display.context = context;
  }),
  circle: (x, y, radius, color) => {
    let path = new Path2D();
    path.moveTo(x + radius, y);
    path.arc(x, y, radius, 0, 2 * Math.PI, false);
    return {
      path: path,
      color: color
    };
  },
  draw: (shape) => {
    Display.context.lineWidth = 2;
    Display.context.strokeStyle = BLACK.toString();
    Display.context.fillStyle = shape.color.toString();
    Display.context.stroke(shape.path);
    Display.context.fill(shape.path);
  },
  erase: (shape) => {
    let lineWidth = Display.context.lineWidth;
    Display.context.lineWidth = lineWidth + 1;
    Display.fader(shape, 0);
    Display.context.lineWidth = lineWidth;
  },
  fader: (shape, alpha) => {
    function faded(_color) {
      return color(_color.r, _color.g, _color.b, _color.a * (1 - alpha));
    }
    let old_composite = Display.context.globalCompositeOperation;
    Display.context.globalCompositeOperation = "destination-out";
    Display.context.strokeStyle = faded(BLACK).toString();
    Display.context.fillStyle = faded(shape.color).toString();
    Display.context.stroke(shape.path);
    Display.context.fill(shape.path);
    Display.context.globalCompositeOperation = old_composite;
  },
  flash: (shape) => {
    Display.draw(shape);
    let decay = 0.98;
    function fade() {
      Display.fader(shape, decay);
      decay -= 0.0012
    }
    let interval_ID = setInterval(fade, 100);
    //setTimeout(() => { decay -= 0.05 }, 2000);
    //setTimeout(() => { decay -= 0.05 }, 4000);
    setTimeout(() => {
      clearInterval(interval_ID);
      Display.erase(shape);
    }, 6000);
  },
  smiley: () => {
    let circle = Display.circle(154, 285, 30, GREEN);
    Display.flash(circle);
    return circle;
  },
  toilet: () => {
    let circle = Display.circle(256, 386, 30, GREEN);
    Display.flash(circle);
    return circle;
  },
  skull: () => {
    let circle = Display.circle(350, 537, 30, GREEN);
    Display.flash(circle);
    return circle;
  },
  dog: () => {
    let circle = Display.circle(144, 696, 30, GREEN);
    Display.flash(circle);
    return circle;
  },
  error: () => {

  }
};


function evaluate() {
  let {maximum, minimum} = session.metrics.elapsed_time;
  let time = (session.log.end - session.log.start) / 1000 | 0;
  if (time > maximum) {
    return 0;
  }
  if (session.log.errors.length > session.metrics.error_count.maximum) {
    return 0;
  }
  // Sum lengths of all errors.
  if (session.log.errors.reduce((prev, curr) => prev + curr[1], 0) > session.metrics.error_length.maximum) {
    return 0;
  }
  // Don't cheat.
  if (time < 1) {
    return 0;
  }
  // 60% is bare minimum passing, at max time allowed. 100% is a minimum time or less.
  return Math.min(1, 1 - (1 - 0.6) * (time - minimum) / (maximum - minimum));
}


window.addEventListener('load', () => {

  Display.initialize(document.getElementById('display'));

  console.log("listening");
  window.addEventListener('message', (message) => {
    let wrapper_window = message.source;
    switch (message.data.name) {
      case "session":
        session.id = message.data.value.session_ID;
        session.configuration = message.data.value.configuration;
        session.metrics = message.data.value.metrics;
        break;
      case "start_exercise":
        session.log.start = Date.now();
        break;
      case "end_exercise":
        session.log.end = Date.now();
        break;
      case "events":
        switch (message.data.value[1]) {
          case 42:  // Ready to start
            wrapper_window.postMessage({
              name: "ready"
            }, wrapper_window_origin);
            break;
          case 0:   // Start button pressed
            session.log.start = Date.now();
            wrapper_window.postMessage({
              name: "start_exercise"
            }, wrapper_window_origin);
            break;
          case -1:  // Victory!
            session.log.end = Date.now();
            wrapper_window.postMessage({
              name: "end_exercise"
            }, wrapper_window_origin);
            break;
          case -2:  // Failure :-(
            session.log.end = Date.now();
            wrapper_window.postMessage({
              name: "end_exercise"
            }, wrapper_window_origin);
            break;
          case 1:   // Smiley removed
            session.log.smiley = message.data.value[0];
            // TODO: Update display
            Display.smiley();
            break;
          case 2:   // Toilet removed
            session.log.toilet = message.data.value[0];
            // TODO: Update display
            Display.toilet();
            break;
          case 3:   // Skull removed
            session.log.skull = message.data.value[0];
            // TODO: Update display
            Display.skull();
            break;
          case 4:   // Dog removed
            session.log.dog = message.data.value[0];
            // TODO: Update display
            Display.dog();
            break;
        }
        break;
      case "errors":
        session.log.errors.push(message.data.value);
        // TODO: Display error
        break;
      case "results_request":
        // TODO: FIXME
        wrapper_window.postMessage({
          name: "results",
          results: {
            session: session.log.id,
            device: 'Operation: Operation Operation',
            start_time: session.log.start / 1000 | 0,
            elapsed_time: (session.log.end - session.log.start) / 1000 | 0,
            events: session.log,
            success: evaluate(),
            configuration: session.configuration,
            metrics: session.metrics
          }
        }, wrapper_window_origin);
        break;
    }
  })
  
});

window.Display = Display;