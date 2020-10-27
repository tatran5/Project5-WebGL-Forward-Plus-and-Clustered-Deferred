import TextureBuffer from './textureBuffer';
import Wireframe from '../wireframe';

import { Frustum, Plane, Vector2, Vector3 } from '../../node_modules/three/build/three'
import { LIGHT_RADIUS } from '../scene';
import { NUM_LIGHTS } from '../scene';
import { mat2, vec2 } from 'gl-matrix';
import { mat3, vec3 } from 'gl-matrix';
import { mat4, vec4 } from 'gl-matrix';
import { Matrix4 } from '../../node_modules/three/build/three'
import { Sphere } from '../../node_modules/three/build/three'
import { Vector4 } from '../../node_modules/three/build/three'

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    // TODO: TEST ONLY, DELETE
    this._firstCall = 0;
  }

  // LOOKS RIGHT
  // Given a 2d point in slice space, return it in world space coordinate
  // params:
  //  - resolution (Vector2): width and height of the canvas (or image)
  //  - sliceDimension (Vector2): per slice width and height 
  //  - camera (Camera): likely is perspective camera 
  //  - viewProjectionMatrixInverse (Matrix4): View_inverse * Proj_inverse
  //  - pointSliceSpace (Vector2): x and y coordinates in slice space
  // returns:
  //  - pointWorldSpace (Vector3)
  sliceSpace2DToWorldSpace(farClip, viewProjectionMatrixInverse, pointSliceSpace) {   
    // Transform to normalized device coordinate  (homogenized)
    var pointNDC = vec4.create()
    pointNDC[0] = (pointSliceSpace[0] / this._xSlices) * 2.0 - 1;
    pointNDC[1] = 1.0 - (pointSliceSpace[1] / this._xSlices) * 2.0;
    pointNDC[2] = 1;
    pointNDC[3] = 1;

    // Transform to world space
    var pointNonNDC = vec4.create()
    vec4.scale(pointNonNDC, pointNDC, farClip);

    var pointWorldSpace = vec4.create()
    vec4.transformMat4(pointWorldSpace, pointNonNDC, viewProjectionMatrixInverse);

    var pointWorldSpaceVec3 = vec3.create();
    pointWorldSpaceVec3[0] = pointWorldSpace[0]
    pointWorldSpaceVec3[1] = pointWorldSpace[1]
    pointWorldSpaceVec3[2] = pointWorldSpace[2]
    return pointWorldSpaceVec3;
  }

  // Based on https://keisan.casio.com/exec/system/1223596129
  // Based on http://www.songho.ca/math/plane/plane.html
  // Normals: (point2 - point1) x (point0 - point1)
  // params:
  //  - point1 (Vector3)
  //  - point2 (Vector3)
  //  - point3 (Vector3)
  // returns:
  //  
  getPlaneFrom3Points(point0, point1, point2) {
    var v0 = vec3.create();
    var v1 = vec3.create();
    vec3.subtract(v0, point2, point1);
    vec3.subtract(v0, point0, point1);
   
    // normal: the normal of the plane (normalized)
    var normal = vec3.create();
    vec3.cross(normal, v0, v1);
    vec3.normalize(normal, normal);

    // constant: the distance from the origin to the plane
    var constant = -(normal[0] * point1[0] + normal[1] * point1[1] + normal[2] * point1[2]); // this is d in ax + by + cz + d = 0
    
    var plane = new Plane(new Vector3(normal[0], normal[1], normal[2]), constant);
    return plane;
  }

  getPointNearClipFromPointFarClip(camera, pointFarClip) {
    var pointNearClip = vec3.create()
    var nearOverFar = camera.near / camera.far;
    pointNearClip[0] = nearOverFar * pointFarClip[0];
    pointNearClip[1] = nearOverFar * pointFarClip[1];
    pointNearClip[2] = nearOverFar * pointFarClip[2];
    return pointNearClip;
  }

  // params:
  //  camera (Camera): likely to be PerspectiveCamera
  //  tileWorldSpace (Vector3): point on the 2d plane on far clip representing a coordinate of the 2d tile
  //  numSliceZ (int): number of slices in z direction
  //  sliceZ (int): the current z coordinate of the slice in slice space
  // returns;
  //  pointWorldSpace (Vector3): treating the tileWorldSpace as on camera's far clip (highest possible value), want to find
  //    the corresponding point to slice z value (aka scale down from far clip and away from near clip)
  getSliceWorldSpaceFromTileWorldSpace(pointFarClip, pointNearClip, numSliceZ, sliceZ) {
    var sliceScale = sliceZ / numSliceZ;

    var vNearClipToFarClip = vec3.create();
    vec3.subtract(vNearClipToFarClip, pointFarClip, pointNearClip);
    
    var pointNormalizedSlice = vec3.create();
    pointNormalizedSlice[0] = vNearClipToFarClip[0] * sliceScale;
    pointNormalizedSlice[1] = vNearClipToFarClip[1] * sliceScale;
    pointNormalizedSlice[2] = vNearClipToFarClip[2] * sliceScale;
    //vec3.scale(pointNormalizedSlice, vNearClipToFarClip, sliceScale);
    
    var pointSliceWorldSpace = vec3.create();
    vec3.add(pointSliceWorldSpace, pointNormalizedSlice, pointNearClip);
    return pointSliceWorldSpace;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO TESTONLY DELETE
    var testLight = true;
    var testClip = false;
    var testSubFrustum = false;

    // camera.far = 10;
    // if (this._firstCall > 0) {
    //   return [];
    // }
    

    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial... 

    // Create inverse of view projection matrix
    var viewMatrixInverse = mat4.create();
    mat4.invert(viewMatrixInverse, viewMatrix);

    var projectionMatrixInverse = mat4.create();
    mat4.invert(projectionMatrixInverse, camera.projectionMatrix.elements);

    var viewProjectionMatrixInverse = mat4.create();
    mat4.multiply(viewProjectionMatrixInverse, viewMatrixInverse, projectionMatrixInverse);

    // Other variables stays the same across all loops
    var resolution = vec2.create();
    resolution[0] = canvas.width;
    resolution[1] = canvas.height;
    var numSlices = vec3.create();
    numSlices[0] = this._xSlices;
    numSlices[1] = this._ySlices;
    numSlices[2] = this._zSlices;

    // height and width of a 2d slice in terms of pixels
    var sliceDimension = vec2.create();
    sliceDimension[0] = resolution[0] / this._xSlices;
    sliceDimension[1] = resolution[1] / this._ySlices;
    
    // TODO: DELETE Test only
    var points = [];
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {

          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          
          // Find 4 points on far clips of the frustum from near clip to far clip -----------------------------------------------------------
          var sliceSpaceXY = vec2.create();

          sliceSpaceXY[0] = x;
          
          // slice: (x, y)     
          sliceSpaceXY[1] = y;     
          var pointFarClipUpLeft = this.sliceSpace2DToWorldSpace(camera.far, viewProjectionMatrixInverse, sliceSpaceXY);

          // slice: (x + 1, y)
          sliceSpaceXY[0] = x + 1;
          var pointFarClipUpRight = this.sliceSpace2DToWorldSpace(camera.far, viewProjectionMatrixInverse, sliceSpaceXY);

          // slice: (x + 1, y + 1)
          sliceSpaceXY[1] = y + 1;
          var pointFarClipDownRight = this.sliceSpace2DToWorldSpace(camera.far, viewProjectionMatrixInverse, sliceSpaceXY);
          
          // slice: (x, y + 1)
          sliceSpaceXY[0] = x; 
          var pointFarClipDownLeft = this.sliceSpace2DToWorldSpace(camera.far, viewProjectionMatrixInverse, sliceSpaceXY);

          // Find 4 points on near clips of the frustum from near clip to far clip -----------------------------------------------------------
          var pointNearClipUpLeft = this.getPointNearClipFromPointFarClip(camera, pointFarClipUpLeft);
          var pointNearClipUpRight = this.getPointNearClipFromPointFarClip(camera, pointFarClipUpRight);
          var pointNearClipDownRight = this.getPointNearClipFromPointFarClip(camera, pointFarClipDownRight);
          var pointNearClipDownLeft = this.getPointNearClipFromPointFarClip(camera, pointFarClipDownLeft);

          // Find the 8 points of the frustum             
          var pointNearUpLeft = this.getSliceWorldSpaceFromTileWorldSpace(pointFarClipUpLeft, pointNearClipUpLeft, this._zSlices, z);
          var pointNearUpRight = this.getSliceWorldSpaceFromTileWorldSpace(pointFarClipUpRight, pointNearClipUpRight, this._zSlices, z);
          var pointNearDownRight = this.getSliceWorldSpaceFromTileWorldSpace(pointFarClipDownRight, pointNearClipDownRight, this._zSlices, z);
          var pointNearDownLeft = this.getSliceWorldSpaceFromTileWorldSpace(pointFarClipDownLeft, pointNearClipDownLeft, this._zSlices, z);

          var pointFarUpLeft =  this.getSliceWorldSpaceFromTileWorldSpace(pointFarClipUpLeft, pointNearClipUpLeft, this._zSlices, z + 1);
          var pointFarUpRight = this.getSliceWorldSpaceFromTileWorldSpace(pointFarClipUpRight, pointNearClipUpRight, this._zSlices, z + 1);
          var pointFarDownRight = this.getSliceWorldSpaceFromTileWorldSpace(pointFarClipDownRight, pointNearClipDownRight, this._zSlices, z + 1);
          var pointFarDownLeft = this.getSliceWorldSpaceFromTileWorldSpace(pointFarClipDownLeft, pointNearClipDownLeft, this._zSlices, z + 1);
          
          // Create 6 planes out of these points making a frustum
          var planeFar = this.getPlaneFrom3Points(pointFarUpRight, pointFarUpLeft, pointFarDownLeft); // normal faces away from cam
          var planeNear = this.getPlaneFrom3Points(pointNearUpLeft, pointNearUpRight, pointNearDownRight);// normal faces towards cam
          var planeLeft = this.getPlaneFrom3Points(pointFarUpLeft, pointNearUpLeft, pointNearDownLeft); // normal faces to the left
          var planeRight = this.getPlaneFrom3Points(pointFarUpRight, pointFarDownRight, pointNearDownRight); // normal faces to the right
          var planeUp = this.getPlaneFrom3Points(pointFarUpRight, pointNearUpRight, pointNearUpLeft); // normal faces up
          var planeDown = this.getPlaneFrom3Points(pointFarDownRight, pointNearDownRight, pointNearDownLeft); // normal faces down

          // // Create a frustum out of the planes
          var frustum = new Frustum(planeFar, planeNear, planeLeft, planeRight, planeUp, planeDown);

          if (testLight) {
            var lightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            for (let l = 0; l < 10; ++l) {
              var slotInCluster = Math.floor((lightCount + 4.0) / 4.0); // Have to add 4 because the first index stores the number of light
              var elementInSlot = lightCount % 4;

              // Save the index of the light into the buffer
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, slotInCluster) + elementInSlot] = l;
              // Update the number of light count
              lightCount += 1;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0) + 0] = lightCount;
            }
            
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          }
          
          // Iterates through all the lights to see which light intersects with this frustum (treat lights as point lights)
          for (let l = 0; l < NUM_LIGHTS; ++l) {
            var light = scene.lights[l];
            var lightPos = new Vector3(light.position.x, light.position.y, light.position.z);
            var lightSphere = new Sphere(lightPos, LIGHT_RADIUS);
            
            // Light count is store in the first index & element of this buffer
            var lightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
              
            if (frustum.intersectsSphere(lightSphere) && lightCount < MAX_LIGHTS_PER_CLUSTER) {
              var slotInCluster = Math.floor((lightCount + 4.0) / 4.0); // Have to add 4 because the first index stores the number of light
              var elementInSlot = lightCount % 4;

              // Save the index of the light into the buffer
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, slotInCluster) + elementInSlot] = l;
              // Update the number of light count
              lightCount += 1;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0) + 0] = lightCount;
            }
          }

          // TODO: TEST ONLY, DELETE
          // From near clip to far clip

          if (testClip) {
            points.push([pointNearClipUpLeft[0], pointNearClipUpLeft[1], pointNearClipUpLeft[2]]);
            points.push([pointFarClipUpLeft[0], pointFarClipUpLeft[1], pointFarClipUpLeft[2]]);
            points.push([pointNearClipUpRight[0], pointNearClipUpRight[1], pointNearClipUpRight[2]]);
            points.push([pointFarClipUpRight[0], pointFarClipUpRight[1], pointFarClipUpRight[2]]);
  
            points.push([pointNearClipDownRight[0], pointNearClipDownRight[1], pointNearClipDownRight[2]]);
            points.push([pointFarClipDownRight[0], pointFarClipDownRight[1], pointFarClipDownRight[2]]);
            points.push([pointNearClipDownLeft[0], pointNearClipDownLeft[1], pointNearClipDownLeft[2]]);
            points.push([pointFarClipDownLeft[0], pointFarClipDownLeft[1], pointFarClipDownLeft[2]]);
  
            points.push([pointNearClipUpLeft[0], pointNearClipUpLeft[1], pointNearClipUpLeft[2]]);
            points.push([pointNearClipUpRight[0], pointNearClipUpRight[1], pointNearClipUpRight[2]]);
            points.push([pointNearClipDownRight[0], pointNearClipDownRight[1], pointNearClipDownRight[2]]);
            points.push([pointNearClipDownLeft[0], pointNearClipDownLeft[1], pointNearClipDownLeft[2]]);
            
            points.push([pointFarClipUpLeft[0], pointFarClipUpLeft[1], pointFarClipUpLeft[2]]);
            points.push([pointFarClipDownLeft[0], pointFarClipDownLeft[1], pointFarClipDownLeft[2]]);
            points.push([pointFarClipUpLeft[0], pointFarClipUpLeft[1], pointFarClipUpLeft[2]]);
            points.push([pointFarClipUpRight[0], pointFarClipUpRight[1], pointFarClipUpRight[2]]); 
          }
          
          if (testSubFrustum && y < 1) {            
            points.push([pointNearUpLeft[0], pointNearUpLeft[1], pointNearUpLeft[2]]);
            points.push([pointNearUpRight[0], pointNearUpRight[1], pointNearUpRight[2]]);
            points.push([pointNearUpLeft[0], pointNearUpLeft[1], pointNearUpLeft[2]]);
            points.push([pointNearDownLeft[0], pointNearDownLeft[1], pointNearDownLeft[2]]);
    
            points.push([pointNearUpLeft[0], pointNearUpLeft[1], pointNearUpLeft[2]]);
            points.push([pointFarUpLeft[0], pointFarUpLeft[1], pointFarUpLeft[2]]);
              
            points.push([pointNearUpRight[0], pointNearUpRight[1], pointNearUpRight[2]]);
            points.push([pointFarUpRight[0], pointFarUpRight[1], pointFarUpRight[2]]); 
          }          
        }
      }
    }
    this._firstCall = 1;
    this._clusterTexture.update();
    return points;
  }
}