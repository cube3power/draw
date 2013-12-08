var PI = Math.PI;
var TAU = PI*2;
var toTAU = function(rads) {
  if (rads<0) {
    rads += TAU;
  }

  return rads;
};


function Polygon(points) {
  if (!(this instanceof Polygon)) {
    return new Polygon(points);
  }

  this.points = points || [];
}

Polygon.prototype = {

  each : function(fn) {
    for (var i = 0; i<this.points.length; i++) {
      var prev = i>0 ? this.points[i-1] : this.points[this.points.length-1];
      var next = i<this.points.length-1 ? this.points[i+1] : this.points[0];
      if (fn(prev, this.points[i], next, i) === false) {
        break;
      }
    }
    return this;
  },

  dedupe : function() {
    var seen = {};
    // TODO: make this a tree
    this.points = this.points.filter(function(a) {
      var key = a.x + ':' + a.y;
      if (!seen[key]) {
        seen[key] = true;
        return true;
      }
    });

    return this;
  },

  // Remove identical points occurring one after the other
  clean : function() {
    var last = this.points[this.points.length-1];

    this.points = this.points.filter(function(a) {
      var ret = false;
      if (!last.equal(a)) {
        ret = true;
      }

      last = a;
      return ret;
    });

    return this;
  },

  winding : function() {
    return this.area() > 0;
  },

  rewind : function(cw) {
    cw = !!cw;
    var winding = this.winding();
    if (winding !== cw) {
      this.points.reverse();
    }
    return this;
  },

  area : function() {
    var area = 0;
    var first = this.points[0];

    this.each(function(prev, current, next, idx) {
      if (idx<2) { return; }

      var edge1 = first.subtract(current, true);
      var edge2 = first.subtract(prev, true);
      area += ((edge1.x * edge2.y) - (edge1.y * edge2.x))/2
    });

    return area;
  },

  closestPointTo : function(vec) {
    var points = [];

    this.each(function(prev, current, next) {
      // TODO: optimize
      var a = prev;
      var b = current;
      var ab = b.subtract(a, true);
      var veca = vec.subtract(a, true);
      var vecadot = veca.clone().dot(ab);
      var abdot = ab.clone().dot(ab);

      var t = vecadot/abdot;

      if (t<0) {
        t = 0;
      }

      if (t>1) {
        t = 1;
      }

      var point = ab.multiply(t, true).add(a);

      points.push({
        distance: point.distance(vec),
        point : point
      });
    });

    var obj = points.sort(function(a, b) {
      return a.distance-b.distance;
    })[0];

    var point = obj.point;
    point.distanceToCurrent = obj.distance;

    this.each(function(prev, current, next) {
      if (point.equal(current)) {
        point.current = current;
        point.prev = prev;
        point.next = next;
        return false;
      }
    });

    return point;
  },

  scale : function(amount) {
    this.each(function(p, c) {
      c.multiply(amount);
    });
    return this;
  },

  containsPoint : function(point) {
    var type=0,
        // Avoid intersections with points as they
        // cause weird results.

        // TODO: this is prone to errors when the x is < -1e10
        //       calculating the x off of the AABB would be prefered
        left = Vec2(0, point.y + .00001),
        seen = {};


    this.each(function(prev, current, next) {
      var i = segseg(left, point, current, next);
      if (i && i!==true) {
        type++;
      }
    });


    return type%2 === 1;
  },

  containsPolygon : function(subject) {
    var ret = true, that = this;
    subject.each(function(p, c, n) {
      if (!that.containsPoint(c)) {
        ret = false;
        return false;
      }
    });
    return ret;
  },


  aabb : function() {
    var xmin, xmax, ymax, ymin;
    xmax = xmin = this.points[1].x;
    ymax = ymin = this.points[1].y;

    this.each(function(p, c) {
      if (c.x > xmax) {
        xmax = c.x;
      }

      if (c.x < xmin) {
        xmin = c.x;
      }

      if (c.y > ymax) {
        ymax = c.y;
      }

      if (c.y < ymin) {
        ymin = c.y;
      }
    });

    return {
      x : xmin,
      y : ymin,
      w : xmax - xmin,
      h : ymax - ymin
    };
  },

  offset : function(delta) {

    var ret = [],
        last = null,
        bisectors = [];

    // Compute bisectors
    this.each(function(prev, current, next, idx) {
      var e1 = current.subtract(prev, true).normalize();
      var e2 = current.subtract(next, true).normalize();
      var ecross = e1.perpDot(e2);
      var length = delta / Math.sin(Math.acos(e1.dot(e2))/2);

      length = -length;

      var angleToZero = lineRadsFromZero(prev, current);
      var rads = lineIntersectionRads(prev, current, next);
      var bisector = Vec2(length, 0).rotate(angleToZero - rads/2);

      if (ecross < 0)
      {
        bisector.add(current);
      } else {
        bisector = current.subtract(bisector, true);
      }
      bisector.cornerAngle = rads;
      current.bisector = bisector;
      bisector.point = current;
      ret.push(bisector);
    });

    return Polygon(ret);
  },

  offset1 : function(delta) {

    var ret = [],
        last = null,
        bisectors = [];

    // Compute bisectors
    this.each(function(prev, current, next, idx) {
      var e1 = current.subtract(prev, true).normalize();
      var e2 = current.subtract(next, true).normalize();
      var e = e1.add(e2, true).normalize();

      var diff = delta / Math.sin(Math.acos(e1.dot(e2))/2);

      var inter = diff;//e.dot(Vec2(diff, diff)); 
      var o;
      if (e1.perpDot(e2) < 0) {
        o = current.add(Vec2(inter, inter), true);
      } else {
        o = current.subtract(Vec2(inter, inter), true);
      }
      
      o.point = current;

      //ret.push(o);

      

      if (delta > 0) {
        length = -length;
      }

      var cornerAngle = toTAU(current.subtract(prev, true).angleTo(next.subtract(current, true)));
      var angleToCorner = toTAU(current.subtract(prev, true).angleTo(Vec2(1, 0)));
      var bisector = Vec2(length, 0).rotate(TAU/4 + cornerAngle/2 - angleToCorner);

      if ((delta < 0 && cornerAngle - PI < 0) ||
          (delta > 0 && cornerAngle - PI > 0))
      {
        bisector.add(current);
      } else {
        bisector = current.subtract(bisector, true);
      }
      bisector.cornerAngle = cornerAngle;
      current.bisector = bisector;
      bisector.point = current;
      ret.push(bisector);
    });

    return Polygon(ret);
  },

  get length() {
    return this.points.length
  },

  point : function(index) {
    if (index >= 0 && index < this.points.length) {
      return this.points[index];
    }
  },

  clone : function() {
    var points = [];
    this.each(function(p, c) {
      points.push(c.clone());
    });
    return new Polygon(points);
  }
};