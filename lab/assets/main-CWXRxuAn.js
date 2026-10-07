const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/corridor-BjNrCbiN.js","assets/Style-DOuyqAVF.js","assets/Builder-dhC2zwri.js","assets/Decal-D9oxym7J.js","assets/tex-65QnFpt2.js","assets/seg3-ohGtXkbA.js","assets/station-Dh5NO2o4.js","assets/kit-9HCdy0_i.js","assets/pool-B8U4rl5_.js","assets/zoneD-Cjbzr-pI.js","assets/alley-DWo0OIqr.js","assets/PaintMaterial-DfdVrC-T.js","assets/layout-y1Tug7yB.js","assets/pastel-mhTijeDi.js","assets/station-CC6e_dHg.js","assets/pool-DXng4CRa.js","assets/corridor-CkaOt3Xz.js","assets/pastel-DyU0Crj8.js","assets/alley-BJHSVtvR.js","assets/test-XpdyUxcx.js"])))=>i.map(i=>d[i]);
import{$ as e,A as t,An as n,Bn as r,Ct as i,D as a,Dn as o,E as s,En as c,F as l,Fn as u,Gn as d,H as f,Hn as p,In as m,J as h,Jn as g,Kn as _,L as v,Ln as y,Mn as b,Nn as x,O as S,On as C,P as w,Pn as T,Q as E,Qn as D,R as O,Rn as k,S as A,Sn as j,T as M,Tn as N,Un as ee,Vn as te,Wn as ne,X as P,Xn as re,Y as ie,Yn as F,Z as ae,Zn as I,_ as L,_t as R,a as z,an as oe,at as se,b as ce,c as le,ct as B,d as ue,dt as V,en as de,et as H,f as fe,fn as pe,hn as me,ht as he,i as ge,it as _e,k as ve,l as ye,lt as be,mn as xe,mt as Se,n as Ce,nn as we,nt as U,on as Te,ot as Ee,pn as De,pt as W,q as Oe,qn as ke,rt as Ae,s as G,sn as je,st as Me,tn as Ne,tt as Pe,u as Fe,ut as K,v as q,w as Ie,wt as Le,x as J,xn as Y,y as Re,yt as ze,z as Be,zn as Ve}from"./Style-DOuyqAVF.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function He(){let e=null,t=!1,n=null,r=null;function i(t,a){r=e.requestAnimationFrame(i),n(t,a)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function Ue(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var X={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},Z={common:{diffuse:{value:new q(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new H},alphaMap:{value:null},alphaMapTransform:{value:new H},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new H}},envmap:{envMap:{value:null},envMapRotation:{value:new H},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new H}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new H}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new H},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new H},normalScale:{value:new m(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new H},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new H}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new H}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new H}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new q(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new y},probesMax:{value:new y},probesResolution:{value:new y}},points:{diffuse:{value:new q(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new H},alphaTest:{value:0},uvTransform:{value:new H}},sprite:{diffuse:{value:new q(16777215)},opacity:{value:1},center:{value:new m(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new H},alphaMap:{value:null},alphaMapTransform:{value:new H},alphaTest:{value:0}}},We={basic:{uniforms:F([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.fog]),vertexShader:X.meshbasic_vert,fragmentShader:X.meshbasic_frag},lambert:{uniforms:F([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new q(0)},envMapIntensity:{value:1}}]),vertexShader:X.meshlambert_vert,fragmentShader:X.meshlambert_frag},phong:{uniforms:F([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new q(0)},specular:{value:new q(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:X.meshphong_vert,fragmentShader:X.meshphong_frag},standard:{uniforms:F([Z.common,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.roughnessmap,Z.metalnessmap,Z.fog,Z.lights,{emissive:{value:new q(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:X.meshphysical_vert,fragmentShader:X.meshphysical_frag},toon:{uniforms:F([Z.common,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.gradientmap,Z.fog,Z.lights,{emissive:{value:new q(0)}}]),vertexShader:X.meshtoon_vert,fragmentShader:X.meshtoon_frag},matcap:{uniforms:F([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,{matcap:{value:null}}]),vertexShader:X.meshmatcap_vert,fragmentShader:X.meshmatcap_frag},points:{uniforms:F([Z.points,Z.fog]),vertexShader:X.points_vert,fragmentShader:X.points_frag},dashed:{uniforms:F([Z.common,Z.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:X.linedashed_vert,fragmentShader:X.linedashed_frag},depth:{uniforms:F([Z.common,Z.displacementmap]),vertexShader:X.depth_vert,fragmentShader:X.depth_frag},normal:{uniforms:F([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,{opacity:{value:1}}]),vertexShader:X.meshnormal_vert,fragmentShader:X.meshnormal_frag},sprite:{uniforms:F([Z.sprite,Z.fog]),vertexShader:X.sprite_vert,fragmentShader:X.sprite_frag},background:{uniforms:{uvTransform:{value:new H},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:X.background_vert,fragmentShader:X.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new H}},vertexShader:X.backgroundCube_vert,fragmentShader:X.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:X.cube_vert,fragmentShader:X.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:X.equirect_vert,fragmentShader:X.equirect_frag},distance:{uniforms:F([Z.common,Z.displacementmap,{referencePosition:{value:new y},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:X.distance_vert,fragmentShader:X.distance_frag},shadow:{uniforms:F([Z.lights,Z.fog,{color:{value:new q(0)},opacity:{value:1}}]),vertexShader:X.shadow_vert,fragmentShader:X.shadow_frag}};We.physical={uniforms:F([We.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new H},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new H},clearcoatNormalScale:{value:new m(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new H},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new H},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new H},sheen:{value:0},sheenColor:{value:new q(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new H},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new H},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new H},transmissionSamplerSize:{value:new m},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new H},attenuationDistance:{value:0},attenuationColor:{value:new q(0)},specularColor:{value:new q(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new H},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new H},anisotropyVector:{value:new m},anisotropyMap:{value:null},anisotropyMapTransform:{value:new H}}]),vertexShader:X.meshphysical_vert,fragmentShader:X.meshphysical_frag};var Ge={r:0,b:0,g:0},Ke=new Pe,qe=new H;qe.set(-1,0,0,0,1,0,0,0,1);function Je(e,t,n,r,i,a){let o=new q(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function m(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function h(t){let r=!1,i=m(t);i===null?_(o,s):i&&i.isColor&&(_(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function g(t,n){let i=m(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new U(new Fe(1,1,1),new me({name:`BackgroundCubeMaterial`,uniforms:p(We.backgroundCube.uniforms),vertexShader:We.backgroundCube.vertexShader,fragmentShader:We.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(Ke.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(qe),l.material.toneMapped=Re.getTransfer(i.colorSpace)!==De,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new U(new he(2,2),new me({name:`BackgroundMaterial`,uniforms:p(We.background.uniforms),vertexShader:We.background.vertexShader,fragmentShader:We.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=Re.getTransfer(i.colorSpace)!==De,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function _(t,r){t.getRGB(Ge,ke(e)),n.buffers.color.setClear(Ge.r,Ge.g,Ge.b,r,a)}function v(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,_(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,_(o,s)},render:h,addToRenderList:g,dispose:v}}function Ye(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function Xe(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function Ze(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return t===1023||r.convert(t)===e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT)}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&n!==1015&&!i&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(I(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&I(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function Qe(e){let t=this,n=null,r=0,i=!1,a=!1,o=new Se,s=new H,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var $e=4,et=6,tt=20,nt=256,rt=new V,it=new q,at=null,ot=0,st=0,ct=!1,lt=new y,Q=new y,ut=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=lt}=i;at=this._renderer.getRenderTarget(),ot=this._renderer.getActiveCubeFace(),st=this._renderer.getActiveMipmapLevel(),ct=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=_t(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=gt(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(at,ot,st),this._renderer.xr.enabled=ct,e.scissorTest=!1,pt(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),at=this._renderer.getRenderTarget(),ot=this._renderer.getActiveCubeFace(),st=this._renderer.getActiveMipmapLevel(),ct=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:h,minFilter:h,generateMipmaps:!1,type:f,format:i,colorSpace:ae,depthBuffer:!1},r=ft(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=ft(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=dt(r)),this._blurMaterial=ht(r,e,t),this._ggxMaterial=mt(r,e,t)}return r}_compileMaterial(e){let t=new U(new fe,e);this._renderer.compile(t,rt)}_sceneToCubeUV(e,t,n,r,i){let a=new W(90,1,t,n),o=[1,-1,1,1,1,1],s=[1,1,1,-1,-1,-1],c=this._renderer,l=c.autoClear,u=c.toneMapping;c.getClearColor(it),c.toneMapping=0,c.autoClear=!1,c.state.buffers.depth.getReversed()&&(c.setRenderTarget(r),c.clearDepth(),c.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new U(new Fe,new Ae({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let d=this._backgroundBox,f=d.material,p=!1,m=e.background;m?m.isColor&&(f.color.copy(m),e.background=null,p=!0):(f.color.copy(it),p=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x+s[t],i.y,i.z)):n===1?(a.up.set(0,0,o[t]),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y+s[t],i.z)):(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y,i.z+s[t]));let l=this._cubeSize;pt(r,n*l,t>2?l:0,l,l),c.setRenderTarget(r),p&&c.render(d,a),c.render(e,a)}c.toneMapping=u,c.autoClear=l,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=_t()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=gt());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;pt(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,rt)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-$e?n-d+$e:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,pt(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,rt),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,pt(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,rt)}_blur(e,t,n,r){let i=this._pingPongRenderTarget,a=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(e,i,t,n,a),this._blurPass(i,e,n,n,a)}_blurPass(e,t,n,r,i){let a=this._renderer,o=this._blurMaterial,s=this._lodMeshes[r];s.material=o;let c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=i,c.mipInt.value=this._lodMax-n;let l=this._sizeLods[r];pt(t,3*l*(r>this._lodMax-$e?r-this._lodMax+$e:0),4*(this._cubeSize-l),3*l,2*l),a.setRenderTarget(t),a.render(s,rt)}};function dt(e){let t=[],n=[],r=e,i=e-$e+1+et;for(let e=0;e<i;e++){let e=2**r;t.push(e);let i=1/(e-2),a=-i,o=1+i,s=[a,a,o,a,o,o,a,a,o,o,a,o],c=new Float32Array(108),l=new Float32Array(108);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];c.set(r,18*e);for(let t=0;t<6;t++){let n=s[t*2]*2-1,r=s[t*2+1]*2-1;e===0?Q.set(1,r,n):e===1?Q.set(-n,1,-r):e===2?Q.set(-n,r,1):e===3?Q.set(-1,r,-n):e===4?Q.set(-n,-1,r):Q.set(n,r,-1),Q.toArray(l,(e*6+t)*3)}}let u=new fe;u.setAttribute(`position`,new ue(c,3)),u.setAttribute(`outputDirection`,new ue(l,3)),n.push(new U(u,null)),r>$e&&r--}return{lodMeshes:n,sizeLods:t}}function ft(e,t,n){let i=new r(e,t,n);return i.texture.mapping=306,i.texture.name=`PMREM.cubeUv`,i.scissorTest=!0,i}function pt(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function mt(e,t,n){return new me({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:nt,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:vt(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function ht(e,t,n){return new me({name:`SphericalGaussianBlur`,defines:{SAMPLES:tt,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:vt(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function gt(){return new me({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:vt(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function _t(){return new me({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:vt(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function vt(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var yt=class extends r{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new A(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new Fe(5,5,5),i=new me({name:`CubemapFromEquirect`,uniforms:p(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new U(r,i),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=h),new ce(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function bt(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304){if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}{let r=n.image;if(r&&r.height>0){let i=new yt(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}return null}}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new ut(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new ut(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function xt(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&D(`WebGLRenderer: `+e+` extension not supported.`),t}}}function St(e,t,n,r){let i={},a=new WeakMap;function o(e){let s=e.target;s.index!==null&&t.remove(s.index);for(let e in s.attributes)t.remove(s.attributes[e]);s.removeEventListener(`dispose`,o),delete i[s.id];let c=a.get(s);c&&(t.remove(c),a.delete(s)),r.releaseStatesOfGeometry(s),s.isInstancedBufferGeometry===!0&&delete s._maxInstanceCount,n.memory.geometries--}function s(e,t){return i[t.id]===!0?t:(t.addEventListener(`dispose`,o),i[t.id]=!0,n.memory.geometries++,t)}function l(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function u(e){let n=[],r=e.index,i=e.attributes.position,o=0;if(i===void 0)return;if(r!==null){let e=r.array;o=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;o=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let s=new(i.count>=65535?c:N)(n,1);s.version=o;let l=a.get(e);l&&t.remove(l),a.set(e,s)}function d(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&u(e)}else u(e);return a.get(e)}return{get:s,update:l,getWireframeAttribute:d}}function Ct(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function wt(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:d(`WebGLInfo: Unknown draw mode:`,r)}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function Tt(e,t,n){let r=new WeakMap,i=new k;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,h=1;p>t.maxTextureSize&&(h=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let g=new Float32Array(p*h*4*u),_=new M(g,p,h,u);_.type=O,_.needsUpdate=!0;let v=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*h*4*t;for(let t=0;t<r.count;t++){let s=t*v;e===!0&&(i.fromBufferAttribute(r,t),g[d+s+0]=i.x,g[d+s+1]=i.y,g[d+s+2]=i.z,g[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),g[d+s+4]=i.x,g[d+s+5]=i.y,g[d+s+6]=i.z,g[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),g[d+s+8]=i.x,g[d+s+9]=i.y,g[d+s+10]=i.z,g[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:_,size:new m(p,h)},r.set(o,d);function y(){_.dispose(),r.delete(o),o.removeEventListener(`dispose`,y)}o.addEventListener(`dispose`,y)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function Et(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var Dt={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function Ot(e,t,n,i,a,o){let s=new r(t,n,{type:e,depthBuffer:a,stencilBuffer:o,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),c=null,l=null,u=new fe;u.setAttribute(`position`,new v([-1,3,0,-1,-1,0,3,-1,0],3)),u.setAttribute(`uv`,new v([0,2,0,0,2,0],2));let d=new we({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),p=new U(u,d),m=new V(-1,1,1,-1,0,1),h=null,g=null,_=!1,y,b=null,x=[],S=!1;this.setSize=function(e,t){s.setSize(e,t),c!==null&&c.setSize(e,t),l!==null&&l.setSize(e,t);for(let n=0;n<x.length;n++){let r=x[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){x=e,S=x.length>0&&x[0].isRenderPass===!0;let t=s.width,n=s.height;x.length>0&&c===null&&(c=new r(t,n,{type:f,depthBuffer:!1,stencilBuffer:!1}),l=new r(t,n,{type:f,depthBuffer:!1,stencilBuffer:!1}));for(let e=0;e<x.length;e++){let r=x[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(_||e.toneMapping===0&&x.length===0)return!1;if(b=t,t!==null){let e=t.width,n=t.height;(s.width!==e||s.height!==n)&&this.setSize(e,n)}return S===!1&&e.setRenderTarget(s),y=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return S},this.end=function(e,t){e.toneMapping=y,_=!0;let n=s,r=c;for(let i=0;i<x.length;i++){let a=x[i];a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1&&(n=r,r=r===c?l:c))}if(h!==e.outputColorSpace||g!==e.toneMapping){h=e.outputColorSpace,g=e.toneMapping,d.defines={},Re.getTransfer(h)===`srgb`&&(d.defines.SRGB_TRANSFER=``);let t=Dt[g];t&&(d.defines[t]=``),d.needsUpdate=!0}d.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(b),e.render(p,m),b=null,_=!1},this.isCompositing=function(){return _},this.dispose=function(){s.dispose(),c!==null&&c.dispose(),l!==null&&l.dispose(),u.dispose(),d.dispose()}}var kt=new j,At=new t(1,1),jt=new M,Mt=new Ie,Nt=new A,Pt=[],Ft=[],It=new Float32Array(16),Lt=new Float32Array(9),Rt=new Float32Array(4);function zt(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=Pt[i];if(a===void 0&&(a=new Float32Array(i),Pt[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function Bt(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function Vt(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function Ht(e,t){let n=Ft[t];n===void 0&&(n=new Int32Array(t),Ft[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function Ut(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function Wt(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Bt(n,t))return;e.uniform2fv(this.addr,t),Vt(n,t)}}function Gt(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(Bt(n,t))return;e.uniform3fv(this.addr,t),Vt(n,t)}}function Kt(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Bt(n,t))return;e.uniform4fv(this.addr,t),Vt(n,t)}}function qt(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(Bt(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),Vt(n,t)}else{if(Bt(n,r))return;Rt.set(r),e.uniformMatrix2fv(this.addr,!1,Rt),Vt(n,r)}}function Jt(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(Bt(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),Vt(n,t)}else{if(Bt(n,r))return;Lt.set(r),e.uniformMatrix3fv(this.addr,!1,Lt),Vt(n,r)}}function Yt(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(Bt(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),Vt(n,t)}else{if(Bt(n,r))return;It.set(r),e.uniformMatrix4fv(this.addr,!1,It),Vt(n,r)}}function Xt(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function Zt(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Bt(n,t))return;e.uniform2iv(this.addr,t),Vt(n,t)}}function Qt(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(Bt(n,t))return;e.uniform3iv(this.addr,t),Vt(n,t)}}function $t(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Bt(n,t))return;e.uniform4iv(this.addr,t),Vt(n,t)}}function en(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function tn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Bt(n,t))return;e.uniform2uiv(this.addr,t),Vt(n,t)}}function nn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(Bt(n,t))return;e.uniform3uiv(this.addr,t),Vt(n,t)}}function rn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Bt(n,t))return;e.uniform4uiv(this.addr,t),Vt(n,t)}}function an(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?(At.compareFunction=n.isReversedDepthBuffer()?518:515,a=At):a=kt,n.setTexture2D(t||a,i)}function on(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||Mt,i)}function sn(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||Nt,i)}function cn(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||jt,i)}function ln(e){switch(e){case 5126:return Ut;case 35664:return Wt;case 35665:return Gt;case 35666:return Kt;case 35674:return qt;case 35675:return Jt;case 35676:return Yt;case 5124:case 35670:return Xt;case 35667:case 35671:return Zt;case 35668:case 35672:return Qt;case 35669:case 35673:return $t;case 5125:return en;case 36294:return tn;case 36295:return nn;case 36296:return rn;case 35678:case 36198:case 36298:case 36306:case 35682:return an;case 35679:case 36299:case 36307:return on;case 35680:case 36300:case 36308:case 36293:return sn;case 36289:case 36303:case 36311:case 36292:return cn}}function un(e,t){e.uniform1fv(this.addr,t)}function dn(e,t){let n=zt(t,this.size,2);e.uniform2fv(this.addr,n)}function fn(e,t){let n=zt(t,this.size,3);e.uniform3fv(this.addr,n)}function pn(e,t){let n=zt(t,this.size,4);e.uniform4fv(this.addr,n)}function mn(e,t){let n=zt(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function hn(e,t){let n=zt(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function gn(e,t){let n=zt(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function _n(e,t){e.uniform1iv(this.addr,t)}function vn(e,t){e.uniform2iv(this.addr,t)}function yn(e,t){e.uniform3iv(this.addr,t)}function bn(e,t){e.uniform4iv(this.addr,t)}function xn(e,t){e.uniform1uiv(this.addr,t)}function Sn(e,t){e.uniform2uiv(this.addr,t)}function Cn(e,t){e.uniform3uiv(this.addr,t)}function wn(e,t){e.uniform4uiv(this.addr,t)}function Tn(e,t,n){let r=this.cache,i=t.length,a=Ht(n,i);Bt(r,a)||(e.uniform1iv(this.addr,a),Vt(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?At:kt;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function En(e,t,n){let r=this.cache,i=t.length,a=Ht(n,i);Bt(r,a)||(e.uniform1iv(this.addr,a),Vt(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||Mt,a[e])}function Dn(e,t,n){let r=this.cache,i=t.length,a=Ht(n,i);Bt(r,a)||(e.uniform1iv(this.addr,a),Vt(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||Nt,a[e])}function On(e,t,n){let r=this.cache,i=t.length,a=Ht(n,i);Bt(r,a)||(e.uniform1iv(this.addr,a),Vt(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||jt,a[e])}function kn(e){switch(e){case 5126:return un;case 35664:return dn;case 35665:return fn;case 35666:return pn;case 35674:return mn;case 35675:return hn;case 35676:return gn;case 5124:case 35670:return _n;case 35667:case 35671:return vn;case 35668:case 35672:return yn;case 35669:case 35673:return bn;case 5125:return xn;case 36294:return Sn;case 36295:return Cn;case 36296:return wn;case 35678:case 36198:case 36298:case 36306:case 35682:return Tn;case 35679:case 36299:case 36307:return En;case 35680:case 36300:case 36308:case 36293:return Dn;case 36289:case 36303:case 36311:case 36292:return On}}var An=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=ln(t.type)}},jn=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=kn(t.type)}},Mn=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},Nn=/(\w+)(\])?(\[|\.)?/g;function Pn(e,t){e.seq.push(t),e.map[t.id]=t}function Fn(e,t,n){let r=e.name,i=r.length;for(Nn.lastIndex=0;;){let a=Nn.exec(r),o=Nn.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){Pn(n,l===void 0?new An(s,e,t):new jn(s,e,t));break}{let e=n.map[s];e===void 0&&(e=new Mn(s),Pn(n,e)),n=e}}}var In=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);Fn(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function Ln(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var Rn=37297,zn=0;function Bn(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var Vn=new H;function Hn(e){Re._getMatrix(Vn,Re.workingColorSpace,e);let t=`mat3( ${Vn.elements.map(e=>e.toFixed(4))} )`;switch(Re.getTransfer(e)){case E:return[t,`LinearTransferOETF`];case De:return[t,`sRGBTransferOETF`];default:return I(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function Un(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+Bn(e.getShaderSource(t),r)}return i}function Wn(e,t){let n=Hn(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var Gn={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function Kn(e,t){let n=Gn[t];return n===void 0?(I(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var qn=new y;function Jn(){return Re.getLuminanceCoefficients(qn),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${qn.x.toFixed(4)}, ${qn.y.toFixed(4)}, ${qn.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function Yn(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(Qn).join(`
`)}function Xn(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function Zn(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function Qn(e){return e!==``}function $n(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function er(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var tr=/^[ \t]*#include +<([\w\d./]+)>/gm;function nr(e){return e.replace(tr,ir)}var rr=new Map;function ir(e,t){let n=X[t];if(n===void 0){let e=rr.get(t);if(e!==void 0)n=X[e],I(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`THREE.WebGLProgram: Can not resolve #include <`+t+`>`)}return nr(n)}var ar=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function or(e){return e.replace(ar,sr)}function sr(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function cr(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var lr={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function ur(e){return lr[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var dr={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function fr(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:dr[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var pr={302:`ENVMAP_MODE_REFRACTION`};function mr(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:pr[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var hr={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function gr(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:hr[e.combine]||`ENVMAP_BLENDING_NONE`}function _r(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function vr(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=ur(n),l=fr(n),u=mr(n),f=gr(n),p=_r(n),m=Yn(n),h=Xn(a),g=i.createProgram(),_,v,y=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,h].filter(Qn).join(`
`),_.length>0&&(_+=`
`),v=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,h].filter(Qn).join(`
`),v.length>0&&(v+=`
`)):(_=[cr(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,h,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(Qn).join(`
`),v=[cr(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,h,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+f:``,p?`#define CUBEUV_TEXEL_WIDTH `+p.texelWidth:``,p?`#define CUBEUV_TEXEL_HEIGHT `+p.texelHeight:``,p?`#define CUBEUV_MAX_MIP `+p.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.retroreflection?`#define USE_RETROREFLECTION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:X.tonemapping_pars_fragment,n.toneMapping===0?``:Kn(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,X.colorspace_pars_fragment,Wn(`linearToOutputTexel`,n.outputColorSpace),Jn(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(Qn).join(`
`)),o=nr(o),o=$n(o,n),o=er(o,n),s=nr(s),s=$n(s,n),s=er(s,n),o=or(o),s=or(s),n.isRawShaderMaterial!==!0&&(y=`#version 300 es
`,_=[m,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+_,v=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+v);let b=y+_+o,x=y+v+s,S=Ln(i,i.VERTEX_SHADER,b),C=Ln(i,i.FRAGMENT_SHADER,x);i.attachShader(g,S),i.attachShader(g,C),n.index0AttributeName===void 0?n.hasPositionAttribute===!0&&i.bindAttribLocation(g,0,`position`):i.bindAttribLocation(g,0,n.index0AttributeName),i.linkProgram(g);function w(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(g)||``,r=i.getShaderInfoLog(S)||``,a=i.getShaderInfoLog(C)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(g,i.LINK_STATUS)===!1){if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,g,S,C);else{let e=Un(i,S,`vertex`),n=Un(i,C,`fragment`);d(`WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(g,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}}else o===``?(s===``||c===``)&&(u=!1):I(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:_},fragmentShader:{log:c,prefix:v}})}i.deleteShader(S),i.deleteShader(C),T=new In(i,g),E=Zn(i,g)}let T;this.getUniforms=function(){return T===void 0&&w(this),T};let E;this.getAttributes=function(){return E===void 0&&w(this),E};let D=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return D===!1&&(D=i.getProgramParameter(g,Rn)),D},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(g),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=zn++,this.cacheKey=t,this.usedTimes=1,this.program=g,this.vertexShader=S,this.fragmentShader=C,this}var yr=0,br=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new xr(e),t.set(e,n)),n}},xr=class{constructor(e){this.id=yr++,this.code=e,this.usedTimes=0}};function Sr(e){return e===1030||e===37490||e===36285}function Cr(e,t,n,r,i,a){let s=new Oe,c=new br,l=new Set,u=[],d=new Map,f=r.logarithmicDepthBuffer,p=r.precision,m={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function h(e){return l.add(e),e===0?`uv`:`uv${e}`}function g(i,o,s,u,d,g){let _=u.fog,v=d.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=m[i.type];i.precision!==null&&(p=r.getMaxPrecision(i.precision),p!==i.precision&&I(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,p,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,O,k,A;if(C){let e=We[C];D=e.vertexShader,O=e.fragmentShader}else{D=i.vertexShader,O=i.fragmentShader;let e=c.getVertexShaderStage(i),t=c.getFragmentShaderStage(i);c.update(i,e,t),k=e.id,A=t.id}let j=e.getRenderTarget(),M=e.state.buffers.depth.getReversed(),N=d.isInstancedMesh===!0,ee=d.isBatchedMesh===!0,te=!!i.map,ne=!!i.matcap,P=!!x,re=!!i.aoMap,ie=!!i.lightMap,F=!!i.bumpMap&&i.wireframe===!1,ae=!!i.normalMap,L=!!i.displacementMap,R=!!i.emissiveMap,z=!!i.metalnessMap,oe=!!i.roughnessMap,se=i.anisotropy>0,ce=i.clearcoat>0,le=i.dispersion>0,B=i.retroreflectivity>0,ue=i.iridescence>0,V=i.sheen>0,de=i.transmission>0,H=se&&!!i.anisotropyMap,fe=ce&&!!i.clearcoatMap,pe=ce&&!!i.clearcoatNormalMap,me=ce&&!!i.clearcoatRoughnessMap,he=ue&&!!i.iridescenceMap,ge=ue&&!!i.iridescenceThicknessMap,_e=V&&!!i.sheenColorMap,ve=V&&!!i.sheenRoughnessMap,ye=!!i.specularMap,be=!!i.specularColorMap,xe=!!i.specularIntensityMap,Se=de&&!!i.transmissionMap,Ce=de&&!!i.thicknessMap,we=!!i.gradientMap,U=!!i.alphaMap,Te=i.alphaTest>0,Ee=!!i.alphaHash,De=!!i.extensions,W=0;i.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(W=e.toneMapping);let Oe={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:O,defines:i.defines,customVertexShaderID:k,customFragmentShaderID:A,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:p,batching:ee,batchingColor:ee&&d._colorsTexture!==null,instancing:N,instancingColor:N&&d.instanceColor!==null,instancingMorph:N&&d.morphTexture!==null,outputColorSpace:j===null?e.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Re.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:te,matcap:ne,envMap:P,envMapMode:P&&x.mapping,envMapCubeUVHeight:S,aoMap:re,lightMap:ie,bumpMap:F,normalMap:ae,displacementMap:L,emissiveMap:R,normalMapObjectSpace:ae&&i.normalMapType===1,normalMapTangentSpace:ae&&i.normalMapType===0,packedNormalMap:ae&&i.normalMapType===0&&Sr(i.normalMap.format),metalnessMap:z,roughnessMap:oe,anisotropy:se,anisotropyMap:H,clearcoat:ce,clearcoatMap:fe,clearcoatNormalMap:pe,clearcoatRoughnessMap:me,dispersion:le,retroreflection:B,iridescence:ue,iridescenceMap:he,iridescenceThicknessMap:ge,sheen:V,sheenColorMap:_e,sheenRoughnessMap:ve,specularMap:ye,specularColorMap:be,specularIntensityMap:xe,transmission:de,transmissionMap:Se,thicknessMap:Ce,gradientMap:we,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:U,alphaTest:Te,alphaHash:Ee,combine:i.combine,mapUv:te&&h(i.map.channel),aoMapUv:re&&h(i.aoMap.channel),lightMapUv:ie&&h(i.lightMap.channel),bumpMapUv:F&&h(i.bumpMap.channel),normalMapUv:ae&&h(i.normalMap.channel),displacementMapUv:L&&h(i.displacementMap.channel),emissiveMapUv:R&&h(i.emissiveMap.channel),metalnessMapUv:z&&h(i.metalnessMap.channel),roughnessMapUv:oe&&h(i.roughnessMap.channel),anisotropyMapUv:H&&h(i.anisotropyMap.channel),clearcoatMapUv:fe&&h(i.clearcoatMap.channel),clearcoatNormalMapUv:pe&&h(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:me&&h(i.clearcoatRoughnessMap.channel),iridescenceMapUv:he&&h(i.iridescenceMap.channel),iridescenceThicknessMapUv:ge&&h(i.iridescenceThicknessMap.channel),sheenColorMapUv:_e&&h(i.sheenColorMap.channel),sheenRoughnessMapUv:ve&&h(i.sheenRoughnessMap.channel),specularMapUv:ye&&h(i.specularMap.channel),specularColorMapUv:be&&h(i.specularColorMap.channel),specularIntensityMapUv:xe&&h(i.specularIntensityMap.channel),transmissionMapUv:Se&&h(i.transmissionMap.channel),thicknessMapUv:Ce&&h(i.thicknessMap.channel),alphaMapUv:U&&h(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(ae||se),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:d.isPoints===!0&&!!v.attributes.uv&&(te||U),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&ae===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:M,skinning:d.isSkinnedMesh===!0,hasPositionAttribute:v.attributes.position!==void 0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numSunLights:o.sun.length,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numSunLightShadows:o.sunShadowMap.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&s.length>0,shadowMapType:e.shadowMap.type,toneMapping:W,decodeVideoTexture:te&&i.map.isVideoTexture===!0&&Re.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:R&&i.emissiveMap.isVideoTexture===!0&&Re.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:De&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(De&&i.extensions.multiDraw===!0||ee)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return Oe.vertexUv1s=l.has(1),Oe.vertexUv2s=l.has(2),Oe.vertexUv3s=l.has(3),l.clear(),Oe}function _(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(v(n,t),y(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function v(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numSunLights),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numSunLightShadows),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function y(e,t){s.disableAll(),t.instancing&&s.enable(0),t.instancingColor&&s.enable(1),t.instancingMorph&&s.enable(2),t.matcap&&s.enable(3),t.envMap&&s.enable(4),t.normalMapObjectSpace&&s.enable(5),t.normalMapTangentSpace&&s.enable(6),t.clearcoat&&s.enable(7),t.iridescence&&s.enable(8),t.alphaTest&&s.enable(9),t.vertexColors&&s.enable(10),t.vertexAlphas&&s.enable(11),t.vertexUv1s&&s.enable(12),t.vertexUv2s&&s.enable(13),t.vertexUv3s&&s.enable(14),t.vertexTangents&&s.enable(15),t.anisotropy&&s.enable(16),t.alphaHash&&s.enable(17),t.batching&&s.enable(18),t.dispersion&&s.enable(19),t.retroreflection&&s.enable(24),t.batchingColor&&s.enable(20),t.gradientMap&&s.enable(21),t.packedNormalMap&&s.enable(22),t.vertexNormals&&s.enable(23),e.push(s.mask),s.disableAll(),t.fog&&s.enable(0),t.useFog&&s.enable(1),t.flatShading&&s.enable(2),t.logarithmicDepthBuffer&&s.enable(3),t.reversedDepthBuffer&&s.enable(4),t.skinning&&s.enable(5),t.morphTargets&&s.enable(6),t.morphNormals&&s.enable(7),t.morphColors&&s.enable(8),t.premultipliedAlpha&&s.enable(9),t.shadowMapEnabled&&s.enable(10),t.doubleSided&&s.enable(11),t.flipSided&&s.enable(12),t.useDepthPacking&&s.enable(13),t.dithering&&s.enable(14),t.transmission&&s.enable(15),t.sheen&&s.enable(16),t.opaque&&s.enable(17),t.pointsUvs&&s.enable(18),t.decodeVideoTexture&&s.enable(19),t.decodeVideoTextureEmissive&&s.enable(20),t.alphaToCoverage&&s.enable(21),t.numLightProbeGrids>0&&s.enable(22),t.hasPositionAttribute&&s.enable(23),e.push(s.mask)}function b(e){let t=m[e.type],n;if(t){let e=We[t];n=o.clone(e.uniforms)}else n=e.uniforms;return n}function x(t,n){let r=d.get(n);return r===void 0?(r=new vr(e,n,t,i),u.push(r),d.set(n,r)):++r.usedTimes,r}function S(e){if(--e.usedTimes===0){let t=u.indexOf(e);u[t]=u[u.length-1],u.pop(),d.delete(e.cacheKey),e.destroy()}}function C(e){c.remove(e)}function w(){c.dispose()}return{getParameters:g,getProgramCacheKey:_,getUniforms:b,acquireProgram:x,releaseProgram:S,releaseShaderCache:C,programs:u,dispose:w}}function wr(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function Tr(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Er(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Dr(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l,u){u.reversedDepth===!0&&(c=-c);let d=s(e,t,a,o,c,l);a.transmission>0?r.push(d):a.transparent===!0?i.push(d):n.push(d)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||Tr),r.length>1&&r.sort(t||Er),i.length>1&&i.sort(t||Er)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function Or(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new Dr,e.set(t,[i])):n>=r.length?(i=new Dr,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function kr(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={direction:new y,color:new q};break;case`SpotLight`:n={position:new y,direction:new y,color:new q,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new y,color:new q,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new y,skyColor:new q,groundColor:new q};break;case`RectAreaLight`:n={color:new q,position:new y,halfWidth:new y,halfHeight:new y}}return e[t.id]=n,n}}}function Ar(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new m};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new m};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new m,shadowCameraNear:1,shadowCameraFar:1e3}}return e[t.id]=n,n}}}var jr=0;function Mr(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function Nr(e){let t=new kr,n=Ar(),r={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new y);let i=new y,a=new Pe,o=new Pe;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0,y=0,b=0,x=0;i.sort(Mr);for(let e=0,S=i.length;e<S;e++){let S=i[e],C=S.color,w=S.intensity,T=S.distance,E=null;if(S.shadow&&S.shadow.map&&(E=S.shadow.map.texture.format===1030?S.shadow.map.texture:S.shadow.map.depthTexture||S.shadow.map.texture),S.isAmbientLight)a+=C.r*w,o+=C.g*w,s+=C.b*w;else if(S.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(S.sh.coefficients[e],w);x++}else if(S.isSunLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize.copy(e.mapSize).multiply(e.getFrameExtents()),r.sunShadow[l]=t,r.sunShadowMap[l]=E;let i=e.getViewportCount();for(let t=0;t<i;t++)r.sunShadowMatrix[u+t]=e.getMatrix(t),r.sunShadowCascade[u+t]=e._cascadeData[t];u+=i,l++}r.sun[c]=e,c++}else if(S.isDirectionalLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[d]=t,r.directionalShadowMap[d]=E,r.directionalShadowMatrix[d]=S.shadow.matrix,g++}r.directional[d]=e,d++}else if(S.isSpotLight){let e=t.get(S);e.position.setFromMatrixPosition(S.matrixWorld),e.color.copy(C).multiplyScalar(w),e.distance=T,e.coneCos=Math.cos(S.angle),e.penumbraCos=Math.cos(S.angle*(1-S.penumbra)),e.decay=S.decay,r.spot[p]=e;let i=S.shadow;if(S.map&&(r.spotLightMap[y]=S.map,y++,i.updateMatrices(S),S.castShadow&&b++),r.spotLightMatrix[p]=i.matrix,S.castShadow){let e=n.get(S);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[p]=e,r.spotShadowMap[p]=E,v++}p++}else if(S.isRectAreaLight){let e=t.get(S);e.color.copy(C).multiplyScalar(w),e.halfWidth.set(S.width*.5,0,0),e.halfHeight.set(0,S.height*.5,0),r.rectArea[m]=e,m++}else if(S.isPointLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),e.distance=S.distance,e.decay=S.decay,S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[f]=t,r.pointShadowMap[f]=E,r.pointShadowMatrix[f]=S.shadow.matrix,_++}r.point[f]=e,f++}else if(S.isHemisphereLight){let e=t.get(S);e.skyColor.copy(S.color).multiplyScalar(w),e.groundColor.copy(S.groundColor).multiplyScalar(w),r.hemi[h]=e,h++}}m>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=Z.LTC_FLOAT_1,r.rectAreaLTC2=Z.LTC_FLOAT_2):(r.rectAreaLTC1=Z.LTC_HALF_1,r.rectAreaLTC2=Z.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let S=r.hash;(S.sunLength!==c||S.directionalLength!==d||S.pointLength!==f||S.spotLength!==p||S.rectAreaLength!==m||S.hemiLength!==h||S.numSunShadows!==l||S.numDirectionalShadows!==g||S.numPointShadows!==_||S.numSpotShadows!==v||S.numSpotMaps!==y||S.numLightProbes!==x)&&(r.sun.length=c,r.directional.length=d,r.spot.length=p,r.rectArea.length=m,r.point.length=f,r.hemi.length=h,r.sunShadow.length=l,r.sunShadowMap.length=l,r.sunShadowMatrix.length=u,r.sunShadowCascade.length=u,r.directionalShadow.length=g,r.directionalShadowMap.length=g,r.directionalShadowMatrix.length=g,r.pointShadow.length=_,r.pointShadowMap.length=_,r.pointShadowMatrix.length=_,r.spotShadow.length=v,r.spotShadowMap.length=v,r.spotLightMatrix.length=v+y-b,r.spotLightMap.length=y,r.numSpotLightShadowsWithMaps=b,r.numLightProbes=x,S.sunLength=c,S.directionalLength=d,S.pointLength=f,S.spotLength=p,S.rectAreaLength=m,S.hemiLength=h,S.numSunShadows=l,S.numDirectionalShadows=g,S.numPointShadows=_,S.numSpotShadows=v,S.numSpotMaps=y,S.numLightProbes=x,r.version=jr++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=0,f=t.matrixWorldInverse;for(let t=0,p=e.length;t<p;t++){let p=e[t];if(p.isSunLight){let e=r.sun[n];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),n++}else if(p.isDirectionalLight){let e=r.directional[s];e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),s++}else if(p.isSpotLight){let e=r.spot[l];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),l++}else if(p.isRectAreaLight){let e=r.rectArea[u];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),o.identity(),a.copy(p.matrixWorld),a.premultiply(f),o.extractRotation(a),e.halfWidth.set(p.width*.5,0,0),e.halfHeight.set(0,p.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),u++}else if(p.isPointLight){let e=r.point[c];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),c++}else if(p.isHemisphereLight){let e=r.hemi[d];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),d++}}}return{setup:s,setupView:c,state:r}}function Pr(e){let t=new Nr(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function Fr(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new Pr(e),t.set(n,[a])):r>=i.length?(a=new Pr(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var Ir=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Lr=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Rr=[new y(1,0,0),new y(-1,0,0),new y(0,1,0),new y(0,-1,0),new y(0,0,1),new y(0,0,-1)],zr=[new y(0,-1,0),new y(0,-1,0),new y(0,0,1),new y(0,0,-1),new y(0,-1,0),new y(0,-1,0)],Br=new Pe,Vr=new y,Hr=new y;function Ur(e,n,i){let a=new Be,o=new m,s=new m,c=new k,l=new _e,u=new se,d={},p=i.maxTextureSize,g={0:1,1:0,2:2},_=new me({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new m},radius:{value:4}},vertexShader:Ir,fragmentShader:Lr}),v=_.clone();v.defines.HORIZONTAL_PASS=1;let y=new fe;y.setAttribute(`position`,new ue(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new U(y,_),C=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let w=this.type;this.render=function(n,i,l){if(C.enabled===!1||C.autoUpdate===!1&&C.needsUpdate===!1||n.length===0)return;this.type===2&&(I(`WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`),this.type=1);let u=e.getRenderTarget(),d=e.getActiveCubeFace(),m=e.getActiveMipmapLevel(),g=e.state;g.setBlending(0),g.buffers.depth.getReversed()===!0?g.buffers.color.setClear(0,0,0,0):g.buffers.color.setClear(1,1,1,1),g.buffers.depth.setTest(!0),g.setScissorTest(!1);let _=w!==this.type;_&&i.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let u=0,d=n.length;u<d;u++){let d=n[u],m=d.shadow;if(m===void 0){I(`WebGLShadowMap:`,d,`has no shadow.`);continue}if(m.autoUpdate===!1&&m.needsUpdate===!1)continue;o.copy(m.mapSize);let v=m.getFrameExtents();o.multiply(v),s.copy(m.mapSize),(o.x>p||o.y>p)&&(o.x>p&&(s.x=Math.floor(p/v.x),o.x=s.x*v.x,m.mapSize.x=s.x),o.y>p&&(s.y=Math.floor(p/v.y),o.y=s.y*v.y,m.mapSize.y=s.y));let y=e.state.buffers.depth.getReversed();if(m.camera._reversedDepth=y,m.map===null||_===!0){if(m.map!==null&&(m.map.depthTexture!==null&&(m.map.depthTexture.dispose(),m.map.depthTexture=null),m.map.dispose()),this.type===3){if(d.isPointLight){I(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}m.map=new r(o.x,o.y,{format:de,type:f,minFilter:h,magFilter:h,generateMipmaps:!1}),m.map.texture.name=d.name+`.shadowMap`,m.map.depthTexture=new t(o.x,o.y,O),m.map.depthTexture.name=d.name+`.shadowMapDepth`,m.map.depthTexture.format=S,m.map.depthTexture.compareFunction=null,m.map.depthTexture.minFilter=B,m.map.depthTexture.magFilter=B}else d.isPointLight?(m.map=new yt(o.x),m.map.depthTexture=new J(o.x,b)):(m.map=new r(o.x,o.y),m.map.depthTexture=new t(o.x,o.y,b)),m.map.depthTexture.name=d.name+`.shadowMap`,m.map.depthTexture.format=S,this.type===1?(m.map.depthTexture.compareFunction=y?518:515,m.map.depthTexture.minFilter=h,m.map.depthTexture.magFilter=h):(m.map.depthTexture.compareFunction=null,m.map.depthTexture.minFilter=B,m.map.depthTexture.magFilter=B);m.camera.updateProjectionMatrix()}m.map.isWebGLCubeRenderTarget!==!0&&(m.map.width!==o.x||m.map.height!==o.y)&&m.map.setSize(o.x,o.y);let x=m.map.isWebGLCubeRenderTarget?6:m.getViewportCount();d.isPointLight!==!0&&m.updateMatrices(d,l);for(let t=0;t<x;t++){let n=m.getCamera(t);if(d.isPointLight){let e=m.camera,n=m.matrix,r=d.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),Vr.setFromMatrixPosition(d.matrixWorld),e.position.copy(Vr),Hr.copy(e.position),Hr.add(Rr[t]),e.up.copy(zr[t]),e.lookAt(Hr),e.updateMatrixWorld(),n.makeTranslation(-Vr.x,-Vr.y,-Vr.z),Br.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),m._frustum.setFromProjectionMatrix(Br,e.coordinateSystem,e.reversedDepth)}if(m.map.isWebGLCubeRenderTarget)e.setRenderTarget(m.map,t),e.clear();else{t===0&&(e.setRenderTarget(m.map),e.clear());let n=m.getViewport(t);c.set(s.x*n.x,s.y*n.y,s.x*n.z,s.y*n.w),g.viewport(c)}a=m.getFrustum(t),D(i,l,n,d,this.type)}m.isPointLightShadow!==!0&&this.type===3&&T(m,l),m.needsUpdate=!1}w=this.type,C.needsUpdate=!1,e.setRenderTarget(u,d,m)};function T(t,i){let a=n.update(x);_.defines.VSM_SAMPLES!==t.blurSamples&&(_.defines.VSM_SAMPLES=t.blurSamples,v.defines.VSM_SAMPLES=t.blurSamples,_.needsUpdate=!0,v.needsUpdate=!0),t.mapPass===null?t.mapPass=new r(o.x,o.y,{format:de,type:f}):(t.mapPass.width!==t.map.width||t.mapPass.height!==t.map.height)&&t.mapPass.setSize(t.map.width,t.map.height),_.uniforms.shadow_pass.value=t.map.depthTexture,_.uniforms.resolution.value.set(t.map.width,t.map.height),_.uniforms.radius.value=t.radius,e.setRenderTarget(t.mapPass),e.clear(),e.renderBufferDirect(i,null,a,_,x,null),v.uniforms.shadow_pass.value=t.mapPass.texture,v.uniforms.resolution.value.set(t.map.width,t.map.height),v.uniforms.radius.value=t.radius,e.setRenderTarget(t.map),e.clear(),e.renderBufferDirect(i,null,a,v,x,null)}function E(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?u:l,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=d[e];r===void 0&&(r={},d[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,A)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?g[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function D(t,r,i,o,s){if(t.visible===!1)return;if(t.layers.test(r.layers)&&(t.isMesh||t.isLine||t.isPoints)&&(t.castShadow||t.receiveShadow&&s===3)&&(!t.frustumCulled||t.intersectsFrustum(a))){t.modelViewMatrix.multiplyMatrices(i.matrixWorldInverse,t.matrixWorld);let a=n.update(t),c=t.material;if(Array.isArray(c)){let n=a.groups;for(let l=0,u=n.length;l<u;l++){let u=n[l],d=c[u.materialIndex];if(d&&d.visible){let n=E(t,d,o,s);t.onBeforeShadow(e,t,r,i,a,n,u),e.renderBufferDirect(i,null,a,n,t,u),t.onAfterShadow(e,t,r,i,a,n,u)}}}else if(c.visible){let n=E(t,c,o,s);t.onBeforeShadow(e,t,r,i,a,n,null),e.renderBufferDirect(i,null,a,n,t,null),t.onAfterShadow(e,t,r,i,a,n,null)}}let c=t.children;for(let e=0,t=c.length;e<t;e++)D(c[e],r,i,o,s)}function A(e){e.target.removeEventListener(`dispose`,A);for(let t in d){let n=d[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function Wr(e,t){function n(){let t=!1,n=new k,r=null,i=new k(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?oe(e.DEPTH_TEST):se(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=je[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?oe(e.STENCIL_TEST):se(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},f={},p={},m=new WeakMap,h=[],g=null,_=!1,v=null,y=null,b=null,x=null,S=null,C=null,w=null,T=new q(0,0,0),E=0,D=!1,O=null,A=null,j=null,M=null,N=null,ee=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),te=!1,ne=0,P=e.getParameter(e.VERSION);P.indexOf(`WebGL`)===-1?P.indexOf(`OpenGL ES`)!==-1&&(ne=parseFloat(/^OpenGL ES (\d)/.exec(P)[1]),te=ne>=2):(ne=parseFloat(/^WebGL (\d)/.exec(P)[1]),te=ne>=1);let re=null,ie={},F=e.getParameter(e.SCISSOR_BOX),ae=e.getParameter(e.VIEWPORT),I=new k().fromArray(F),L=new k().fromArray(ae);function R(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let z={};z[e.TEXTURE_2D]=R(e.TEXTURE_2D,e.TEXTURE_2D,1),z[e.TEXTURE_CUBE_MAP]=R(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),z[e.TEXTURE_2D_ARRAY]=R(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),z[e.TEXTURE_3D]=R(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),oe(e.DEPTH_TEST),o.setFunc(3),fe(!1),pe(1),oe(e.CULL_FACE),de(0);function oe(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function se(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function ce(t,n){return p[t]!==n&&(e.bindFramebuffer(t,n),p[t]=n,t===e.DRAW_FRAMEBUFFER&&(p[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(p[e.DRAW_FRAMEBUFFER]=n),!0)}function le(t,n){let r=h,i=!1;if(t){r=m.get(n),r===void 0&&(r=[],m.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function B(t){return g!==t&&(e.useProgram(t),g=t,!0)}let ue={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};ue[103]=e.MIN,ue[104]=e.MAX;let V={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function de(t,n,r,i,a,o,s,c,l,u){if(t===0){_===!0&&(se(e.BLEND),_=!1);return}if(_===!1&&(oe(e.BLEND),_=!0),t!==5){if(t!==v||u!==D){if((y!==100||S!==100)&&(e.blendEquation(e.FUNC_ADD),y=100,S=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:d(`WebGLState: Invalid blending: `,t)}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:d(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:d(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:d(`WebGLState: Invalid blending: `,t)}b=null,x=null,C=null,w=null,T.set(0,0,0),E=0,v=t,D=u}return}a||=n,o||=r,s||=i,(n!==y||a!==S)&&(e.blendEquationSeparate(ue[n],ue[a]),y=n,S=a),(r!==b||i!==x||o!==C||s!==w)&&(e.blendFuncSeparate(V[r],V[i],V[o],V[s]),b=r,x=i,C=o,w=s),(c.equals(T)===!1||l!==E)&&(e.blendColor(c.r,c.g,c.b,l),T.copy(c),E=l),v=t,D=!1}function H(t,n){t.side===2?se(e.CULL_FACE):oe(e.CULL_FACE);let r=t.side===1;n&&(r=!r),fe(r),t.blending===1&&t.transparent===!1?de(0):de(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),he(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?oe(e.SAMPLE_ALPHA_TO_COVERAGE):se(e.SAMPLE_ALPHA_TO_COVERAGE)}function fe(t){O!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),O=t)}function pe(t){t===0?se(e.CULL_FACE):(oe(e.CULL_FACE),t!==A&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),A=t}function me(t){t!==j&&(te&&e.lineWidth(t),j=t)}function he(t,n,r){t?(oe(e.POLYGON_OFFSET_FILL),(M!==n||N!==r)&&(M=n,N=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):se(e.POLYGON_OFFSET_FILL)}function ge(t){t?oe(e.SCISSOR_TEST):se(e.SCISSOR_TEST)}function _e(t){t===void 0&&(t=e.TEXTURE0+ee-1),re!==t&&(e.activeTexture(t),re=t)}function ve(t,n,r){r===void 0&&(r=re===null?e.TEXTURE0+ee-1:re);let i=ie[r];i===void 0&&(i={type:void 0,texture:void 0},ie[r]=i),(i.type!==t||i.texture!==n)&&(re!==r&&(e.activeTexture(r),re=r),e.bindTexture(t,n||z[t]),i.type=t,i.texture=n)}function ye(){let t=ie[re];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function be(){try{e.compressedTexImage2D(...arguments)}catch(e){d(`WebGLState:`,e)}}function xe(){try{e.compressedTexImage3D(...arguments)}catch(e){d(`WebGLState:`,e)}}function Se(){try{e.texSubImage2D(...arguments)}catch(e){d(`WebGLState:`,e)}}function Ce(){try{e.texSubImage3D(...arguments)}catch(e){d(`WebGLState:`,e)}}function we(){try{e.compressedTexSubImage2D(...arguments)}catch(e){d(`WebGLState:`,e)}}function U(){try{e.compressedTexSubImage3D(...arguments)}catch(e){d(`WebGLState:`,e)}}function Te(){try{e.texStorage2D(...arguments)}catch(e){d(`WebGLState:`,e)}}function Ee(){try{e.texStorage3D(...arguments)}catch(e){d(`WebGLState:`,e)}}function De(){try{e.texImage2D(...arguments)}catch(e){d(`WebGLState:`,e)}}function W(){try{e.texImage3D(...arguments)}catch(e){d(`WebGLState:`,e)}}function Oe(t){return f[t]===void 0?e.getParameter(t):f[t]}function ke(t,n){f[t]!==n&&(e.pixelStorei(t,n),f[t]=n)}function Ae(t){I.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),I.copy(t))}function G(t){L.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),L.copy(t))}function Me(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function Ne(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function Pe(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},f={},re=null,ie={},p={},m=new WeakMap,h=[],g=null,_=!1,v=null,y=null,b=null,x=null,S=null,C=null,w=null,T=new q(0,0,0),E=0,D=!1,O=null,A=null,j=null,M=null,N=null,I.set(0,0,e.canvas.width,e.canvas.height),L.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:oe,disable:se,bindFramebuffer:ce,drawBuffers:le,useProgram:B,setBlending:de,setMaterial:H,setFlipSided:fe,setCullFace:pe,setLineWidth:me,setPolygonOffset:he,setScissorTest:ge,activeTexture:_e,bindTexture:ve,unbindTexture:ye,compressedTexImage2D:be,compressedTexImage3D:xe,texImage2D:De,texImage3D:W,pixelStorei:ke,getParameter:Oe,updateUBOMapping:Me,uniformBlockBinding:Ne,texStorage2D:Te,texStorage3D:Ee,texSubImage2D:Se,texSubImage3D:Ce,compressedTexSubImage2D:we,compressedTexSubImage3D:U,scissor:Ae,viewport:G,reset:Pe}}function Gr(e,t,n,r,i,a,o){let s=t.has(`WEBGL_multisampled_render_to_texture`)?t.get(`WEBGL_multisampled_render_to_texture`):null,c=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),l=new m,u=new WeakMap,f=new Set,p,g=new WeakMap,v=!1;try{v=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function y(e,t){return v?new OffscreenCanvas(e,t):ne(`canvas`)}function b(e,t,n){let r=1,i=Ae(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);p===void 0&&(p=y(n,a));let o=t?y(n,a):p;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),I(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}return`data`in e&&I(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e}return e}function x(e){return e.generateMipmaps}function S(t){e.generateMipmap(t)}function C(t){return t.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:t.isWebGL3DRenderTarget?e.TEXTURE_3D:t.isWebGLArrayRenderTarget||t.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function w(n,r,i,a,o,s=!1){if(n!==null){if(e[n]!==void 0)return e[n];I(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+n+`'`)}let c;a&&(c=t.get(`EXT_texture_norm16`),c||I(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let l=r;if(r===e.RED&&(i===e.FLOAT&&(l=e.R32F),i===e.HALF_FLOAT&&(l=e.R16F),i===e.UNSIGNED_BYTE&&(l=e.R8),i===e.UNSIGNED_SHORT&&c&&(l=c.R16_EXT),i===e.SHORT&&c&&(l=c.R16_SNORM_EXT)),r===e.RED_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.R8UI),i===e.UNSIGNED_SHORT&&(l=e.R16UI),i===e.UNSIGNED_INT&&(l=e.R32UI),i===e.BYTE&&(l=e.R8I),i===e.SHORT&&(l=e.R16I),i===e.INT&&(l=e.R32I)),r===e.RG&&(i===e.FLOAT&&(l=e.RG32F),i===e.HALF_FLOAT&&(l=e.RG16F),i===e.UNSIGNED_BYTE&&(l=e.RG8),i===e.UNSIGNED_SHORT&&c&&(l=c.RG16_EXT),i===e.SHORT&&c&&(l=c.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RG8UI),i===e.UNSIGNED_SHORT&&(l=e.RG16UI),i===e.UNSIGNED_INT&&(l=e.RG32UI),i===e.BYTE&&(l=e.RG8I),i===e.SHORT&&(l=e.RG16I),i===e.INT&&(l=e.RG32I)),r===e.RGB_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGB8UI),i===e.UNSIGNED_SHORT&&(l=e.RGB16UI),i===e.UNSIGNED_INT&&(l=e.RGB32UI),i===e.BYTE&&(l=e.RGB8I),i===e.SHORT&&(l=e.RGB16I),i===e.INT&&(l=e.RGB32I)),r===e.RGBA_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGBA8UI),i===e.UNSIGNED_SHORT&&(l=e.RGBA16UI),i===e.UNSIGNED_INT&&(l=e.RGBA32UI),i===e.BYTE&&(l=e.RGBA8I),i===e.SHORT&&(l=e.RGBA16I),i===e.INT&&(l=e.RGBA32I)),r===e.RGB&&(i===e.UNSIGNED_SHORT&&c&&(l=c.RGB16_EXT),i===e.SHORT&&c&&(l=c.RGB16_SNORM_EXT),i===e.UNSIGNED_INT_5_9_9_9_REV&&(l=e.RGB9_E5),i===e.UNSIGNED_INT_10F_11F_11F_REV&&(l=e.R11F_G11F_B10F)),r===e.RGBA){let t=s?E:Re.getTransfer(o);i===e.FLOAT&&(l=e.RGBA32F),i===e.HALF_FLOAT&&(l=e.RGBA16F),i===e.UNSIGNED_BYTE&&(l=t===`srgb`?e.SRGB8_ALPHA8:e.RGBA8),i===e.UNSIGNED_SHORT&&c&&(l=c.RGBA16_EXT),i===e.SHORT&&c&&(l=c.RGBA16_SNORM_EXT),i===e.UNSIGNED_SHORT_4_4_4_4&&(l=e.RGBA4),i===e.UNSIGNED_SHORT_5_5_5_1&&(l=e.RGB5_A1)}return(l===e.R16F||l===e.R32F||l===e.RG16F||l===e.RG32F||l===e.RGBA16F||l===e.RGBA32F)&&t.get(`EXT_color_buffer_float`),l}function T(t,n){let r;return t?n===null||n===1014||n===1020?r=e.DEPTH24_STENCIL8:n===1015?r=e.DEPTH32F_STENCIL8:n===1012&&(r=e.DEPTH24_STENCIL8,I(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):n===null||n===1014||n===1020?r=e.DEPTH_COMPONENT24:n===1015?r=e.DEPTH_COMPONENT32F:n===1012&&(r=e.DEPTH_COMPONENT16),r}function D(e,t){return x(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function O(e){let t=e.target;t.removeEventListener(`dispose`,O),A(t),t.isVideoTexture&&u.delete(t),t.isHTMLTexture&&f.delete(t)}function k(e){let t=e.target;t.removeEventListener(`dispose`,k),M(t)}function A(e){let t=r.get(e);if(t.__webglInit===void 0)return;let n=e.source,i=g.get(n);if(i){let r=i[t.__cacheKey];r.usedTimes--,r.usedTimes===0&&j(e),Object.keys(i).length===0&&g.delete(n)}r.remove(e)}function j(t){let n=r.get(t);e.deleteTexture(n.__webglTexture);let i=t.source,a=g.get(i);delete a[n.__cacheKey],o.memory.textures--}function M(t){let n=r.get(t);if(t.depthTexture&&(t.depthTexture.dispose(),r.remove(t.depthTexture)),t.isWebGLCubeRenderTarget)for(let t=0;t<6;t++){if(Array.isArray(n.__webglFramebuffer[t]))for(let r=0;r<n.__webglFramebuffer[t].length;r++)e.deleteFramebuffer(n.__webglFramebuffer[t][r]);else e.deleteFramebuffer(n.__webglFramebuffer[t]);n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer[t])}else{if(Array.isArray(n.__webglFramebuffer))for(let t=0;t<n.__webglFramebuffer.length;t++)e.deleteFramebuffer(n.__webglFramebuffer[t]);else e.deleteFramebuffer(n.__webglFramebuffer);if(n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer),n.__webglMultisampledFramebuffer&&e.deleteFramebuffer(n.__webglMultisampledFramebuffer),n.__webglColorRenderbuffer)for(let t=0;t<n.__webglColorRenderbuffer.length;t++)n.__webglColorRenderbuffer[t]&&e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);n.__webglDepthRenderbuffer&&e.deleteRenderbuffer(n.__webglDepthRenderbuffer)}let i=t.textures;for(let t=0,n=i.length;t<n;t++){let n=r.get(i[t]);n.__webglTexture&&(e.deleteTexture(n.__webglTexture),o.memory.textures--),r.remove(i[t])}r.remove(t)}let N=0;function ee(){N=0}function te(){return N}function re(e){N=e}function F(){let e=N;return e>=i.maxTextures&&I(`WebGLTextures: Trying to use `+(e+1)+` texture units while this GPU supports only `+i.maxTextures),N+=1,e}function ae(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function R(t,i){let a=r.get(t);if(t.isVideoTexture&&Oe(t),t.isRenderTargetTexture===!1&&t.isExternalTexture!==!0&&t.version>0&&a.__version!==t.version){let e=t.image;if(e===null)I(`WebGLRenderer: Texture marked for update but no image data found.`);else if(e.complete===!1)I(`WebGLRenderer: Texture marked for update but image is incomplete`);else{pe(a,t,i);return}}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,a.__webglTexture,e.TEXTURE0+i)}function z(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){pe(a,t,i);return}t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null),n.bindTexture(e.TEXTURE_2D_ARRAY,a.__webglTexture,e.TEXTURE0+i)}function oe(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){pe(a,t,i);return}n.bindTexture(e.TEXTURE_3D,a.__webglTexture,e.TEXTURE0+i)}function se(t,i){let a=r.get(t);if(t.isCubeDepthTexture!==!0&&t.version>0&&a.__version!==t.version){me(a,t,i);return}n.bindTexture(e.TEXTURE_CUBE_MAP,a.__webglTexture,e.TEXTURE0+i)}let ce={[Te]:e.REPEAT,[L]:e.CLAMP_TO_EDGE,[Me]:e.MIRRORED_REPEAT},le={[B]:e.NEAREST,[K]:e.NEAREST_MIPMAP_NEAREST,[be]:e.NEAREST_MIPMAP_LINEAR,[h]:e.LINEAR,[P]:e.LINEAR_MIPMAP_NEAREST,[ie]:e.LINEAR_MIPMAP_LINEAR},ue={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function V(n,a){if(a.type===1015&&t.has(`OES_texture_float_linear`)===!1&&(a.magFilter===1006||a.magFilter===1007||a.magFilter===1005||a.magFilter===1008||a.minFilter===1006||a.minFilter===1007||a.minFilter===1005||a.minFilter===1008)&&I(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),e.texParameteri(n,e.TEXTURE_WRAP_S,ce[a.wrapS]),e.texParameteri(n,e.TEXTURE_WRAP_T,ce[a.wrapT]),(n===e.TEXTURE_3D||n===e.TEXTURE_2D_ARRAY)&&e.texParameteri(n,e.TEXTURE_WRAP_R,ce[a.wrapR]),e.texParameteri(n,e.TEXTURE_MAG_FILTER,le[a.magFilter]),e.texParameteri(n,e.TEXTURE_MIN_FILTER,le[a.minFilter]),a.compareFunction&&(e.texParameteri(n,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(n,e.TEXTURE_COMPARE_FUNC,ue[a.compareFunction])),t.has(`EXT_texture_filter_anisotropic`)===!0){if(a.magFilter===1003||a.minFilter!==1005&&a.minFilter!==1008||a.type===1015&&t.has(`OES_texture_float_linear`)===!1)return;if(a.anisotropy>1||r.get(a).__currentAnisotropy){let o=t.get(`EXT_texture_filter_anisotropic`);e.texParameterf(n,o.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(a.anisotropy,i.getMaxAnisotropy())),r.get(a).__currentAnisotropy=a.anisotropy}}}function de(t,n){let r=!1;t.__webglInit===void 0&&(t.__webglInit=!0,n.addEventListener(`dispose`,O));let i=n.source,a=g.get(i);a===void 0&&(a={},g.set(i,a));let s=ae(n);if(s!==t.__cacheKey){a[s]===void 0&&(a[s]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,r=!0),a[s].usedTimes++;let i=a[t.__cacheKey];i!==void 0&&(a[t.__cacheKey].usedTimes--,i.usedTimes===0&&j(n)),t.__cacheKey=s,t.__webglTexture=a[s].texture}return r}function H(e,t,n){return Math.floor(Math.floor(e/n)/t)}function fe(t,r,i,a){let o=t.updateRanges;if(o.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,r.width,r.height,i,a,r.data);else{o.sort((e,t)=>e.start-t.start);let s=0;for(let e=1;e<o.length;e++){let t=o[s],n=o[e],i=t.start+t.count,a=H(n.start,r.width,4),c=H(t.start,r.width,4);n.start<=i+1&&a===c&&H(n.start+n.count-1,r.width,4)===a?t.count=Math.max(t.count,n.start+n.count-t.start):(++s,o[s]=n)}o.length=s+1;let c=n.getParameter(e.UNPACK_ROW_LENGTH),l=n.getParameter(e.UNPACK_SKIP_PIXELS),u=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,r.width);for(let t=0,s=o.length;t<s;t++){let s=o[t],c=Math.floor(s.start/4),l=Math.ceil(s.count/4),u=c%r.width,d=Math.floor(c/r.width),f=l;n.pixelStorei(e.UNPACK_SKIP_PIXELS,u),n.pixelStorei(e.UNPACK_SKIP_ROWS,d),n.texSubImage2D(e.TEXTURE_2D,0,u,d,f,1,i,a,r.data)}t.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,c),n.pixelStorei(e.UNPACK_SKIP_PIXELS,l),n.pixelStorei(e.UNPACK_SKIP_ROWS,u)}}function pe(t,o,s){let c=e.TEXTURE_2D;(o.isDataArrayTexture||o.isCompressedArrayTexture)&&(c=e.TEXTURE_2D_ARRAY),o.isData3DTexture&&(c=e.TEXTURE_3D);let l=de(t,o),u=o.source;n.bindTexture(c,t.__webglTexture,e.TEXTURE0+s);let d=r.get(u);if(u.version!==d.__version||l===!0){if(n.activeTexture(e.TEXTURE0+s),!(typeof ImageBitmap<`u`&&o.image instanceof ImageBitmap)){let t=Re.getPrimaries(Re.workingColorSpace),r=o.colorSpace===``?null:Re.getPrimaries(o.colorSpace),i=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,i)}n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment);let t=b(o.image,!1,i.maxTextureSize);t=ke(o,t);let r=a.convert(o.format,o.colorSpace),p=a.convert(o.type),m=w(o.internalFormat,r,p,o.normalized,o.colorSpace,o.isVideoTexture);V(c,o);let h,g=o.mipmaps,v=o.isVideoTexture!==!0,y=d.__version===void 0||l===!0,C=u.dataReady,E=D(o,t);if(o.isDepthTexture)m=T(o.format===ve,o.type),y&&(v?n.texStorage2D(e.TEXTURE_2D,1,m,t.width,t.height):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,null));else if(o.isDataTexture){if(g.length>0){v&&y&&n.texStorage2D(e.TEXTURE_2D,E,m,g[0].width,g[0].height);for(let t=0,i=g.length;t<i;t++)h=g[t],v?C&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data);o.generateMipmaps=!1}else v?(y&&n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height),C&&fe(o,t,r,p)):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,t.data)}else if(o.isCompressedTexture){if(o.isCompressedArrayTexture){v&&y&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,g[0].width,g[0].height,t.depth);for(let i=0,a=g.length;i<a;i++)if(h=g[i],o.format!==1023){if(r!==null){if(v){if(C){if(o.layerUpdates.size>0){let t=_(h.width,h.height,o.format,o.type);for(let a of o.layerUpdates){let o=h.data.subarray(a*t/h.data.BYTES_PER_ELEMENT,(a+1)*t/h.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,a,h.width,h.height,1,r,o)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,h.data)}}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,h.data,0,0)}else I(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`)}else v?C&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,p,h.data):n.texImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,r,p,h.data);o.layerUpdates.size>0&&o.clearLayerUpdates()}else{v&&y&&n.texStorage2D(e.TEXTURE_2D,E,m,g[0].width,g[0].height);for(let t=0,i=g.length;t<i;t++)h=g[t],o.format===1023?v?C&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data):r===null?I(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):v?C&&n.compressedTexSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,h.data):n.compressedTexImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,h.data)}}else if(o.isDataArrayTexture){if(v){if(y&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,t.width,t.height,t.depth),C){if(o.layerUpdates.size>0){let i=_(t.width,t.height,o.format,o.type);for(let a of o.layerUpdates){let o=t.data.subarray(a*i/t.data.BYTES_PER_ELEMENT,(a+1)*i/t.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,a,t.width,t.height,1,r,p,o)}o.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)}}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,m,t.width,t.height,t.depth,0,r,p,t.data)}else if(o.isData3DTexture)v?(y&&n.texStorage3D(e.TEXTURE_3D,E,m,t.width,t.height,t.depth),C&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)):n.texImage3D(e.TEXTURE_3D,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isFramebufferTexture){if(y){if(v)n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height);else{let i=t.width,a=t.height;for(let t=0;t<E;t++)n.texImage2D(e.TEXTURE_2D,t,m,i,a,0,r,p,null),i>>=1,a>>=1}}}else if(o.isHTMLTexture){if(`texElementImage2D`in e){let n=e.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),t.parentNode!==n){n.appendChild(t),f.add(o),n.onpaint=e=>{let t=e.changedElements;for(let e of f)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,t);else{let n=e.RGBA,r=e.RGBA,i=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,n,r,i,t)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(g.length>0){if(v&&y){let t=Ae(g[0]);n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height)}for(let t=0,i=g.length;t<i;t++)h=g[t],v?C&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,r,p,h):n.texImage2D(e.TEXTURE_2D,t,m,r,p,h);o.generateMipmaps=!1}else if(v){if(y){let r=Ae(t);n.texStorage2D(e.TEXTURE_2D,E,m,r.width,r.height)}C&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,r,p,t)}else n.texImage2D(e.TEXTURE_2D,0,m,r,p,t);x(o)&&S(c),d.__version=u.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function me(t,o,s){if(o.image.length!==6)return;let c=de(t,o),l=o.source;n.bindTexture(e.TEXTURE_CUBE_MAP,t.__webglTexture,e.TEXTURE0+s);let u=r.get(l);if(l.version!==u.__version||c===!0){n.activeTexture(e.TEXTURE0+s);let t=Re.getPrimaries(Re.workingColorSpace),r=o.colorSpace===``?null:Re.getPrimaries(o.colorSpace),d=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,d);let f=o.isCompressedTexture||o.image[0].isCompressedTexture,p=o.image[0]&&o.image[0].isDataTexture,m=[];for(let e=0;e<6;e++)!f&&!p?m[e]=b(o.image[e],!0,i.maxCubemapSize):m[e]=p?o.image[e].image:o.image[e],m[e]=ke(o,m[e]);let h=m[0],g=a.convert(o.format,o.colorSpace),_=a.convert(o.type),v=w(o.internalFormat,g,_,o.normalized,o.colorSpace),y=o.isVideoTexture!==!0,C=u.__version===void 0||c===!0,T=l.dataReady,E=D(o,h);V(e.TEXTURE_CUBE_MAP,o);let O;if(f){y&&C&&n.texStorage2D(e.TEXTURE_CUBE_MAP,E,v,h.width,h.height);for(let t=0;t<6;t++){O=m[t].mipmaps;for(let r=0;r<O.length;r++){let i=O[r];o.format===1023?y?T&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,g,_,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,v,i.width,i.height,0,g,_,i.data):g===null?I(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):y?T&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,g,i.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,v,i.width,i.height,0,i.data)}}}else{if(O=o.mipmaps,y&&C){O.length>0&&E++;let t=Ae(m[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,E,v,t.width,t.height)}for(let t=0;t<6;t++)if(p){y?T&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,m[t].width,m[t].height,g,_,m[t].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,v,m[t].width,m[t].height,0,g,_,m[t].data);for(let r=0;r<O.length;r++){let i=O[r].image[t].image;y?T&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,i.width,i.height,g,_,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,v,i.width,i.height,0,g,_,i.data)}}else{y?T&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,g,_,m[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,v,g,_,m[t]);for(let r=0;r<O.length;r++){let i=O[r];y?T&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,g,_,i.image[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,v,g,_,i.image[t])}}}x(o)&&S(e.TEXTURE_CUBE_MAP),u.__version=l.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function he(t,i,o,c,l,u){let d=a.convert(o.format,o.colorSpace),f=a.convert(o.type),p=w(o.internalFormat,d,f,o.normalized,o.colorSpace),m=r.get(i),h=r.get(o);if(h.__renderTarget=i,!m.__hasExternalTextures){let t=Math.max(1,i.width>>u),r=Math.max(1,i.height>>u);l===e.TEXTURE_3D||l===e.TEXTURE_2D_ARRAY?n.texImage3D(l,u,p,t,r,i.depth,0,d,f,null):n.texImage2D(l,u,p,t,r,0,d,f,null)}n.bindFramebuffer(e.FRAMEBUFFER,t),W(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,c,l,h.__webglTexture,0,De(i)):(l===e.TEXTURE_2D||l>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&l<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,c,l,h.__webglTexture,u),n.bindFramebuffer(e.FRAMEBUFFER,null)}function ge(t,n,r){if(e.bindRenderbuffer(e.RENDERBUFFER,t),n.depthBuffer){let i=n.depthTexture,a=i&&i.isDepthTexture?i.type:null,o=T(n.stencilBuffer,a),c=n.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;W(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,De(n),o,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,De(n),o,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,o,n.width,n.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,c,e.RENDERBUFFER,t)}else{let t=n.textures;for(let i=0;i<t.length;i++){let o=t[i],c=a.convert(o.format,o.colorSpace),l=a.convert(o.type),u=w(o.internalFormat,c,l,o.normalized,o.colorSpace);W(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,De(n),u,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,De(n),u,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,u,n.width,n.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function _e(t,i,o){let c=i.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,t),!(i.depthTexture&&i.depthTexture.isDepthTexture))throw Error(`THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.`);let l=r.get(i.depthTexture);if(l.__renderTarget=i,(!l.__webglTexture||i.depthTexture.image.width!==i.width||i.depthTexture.image.height!==i.height)&&(i.depthTexture.image.width=i.width,i.depthTexture.image.height=i.height,i.depthTexture.needsUpdate=!0),c){if(l.__webglInit===void 0&&(l.__webglInit=!0,i.depthTexture.addEventListener(`dispose`,O)),l.__webglTexture===void 0){l.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,l.__webglTexture),V(e.TEXTURE_CUBE_MAP,i.depthTexture);let t=a.convert(i.depthTexture.format),r=a.convert(i.depthTexture.type),o;i.depthTexture.format===1026?o=e.DEPTH_COMPONENT24:i.depthTexture.format===1027&&(o=e.DEPTH24_STENCIL8);for(let n=0;n<6;n++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0,o,i.width,i.height,0,t,r,null)}}else R(i.depthTexture,0);let u=l.__webglTexture,d=De(i),f=c?e.TEXTURE_CUBE_MAP_POSITIVE_X+o:e.TEXTURE_2D,p=i.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(i.depthTexture.format===1026)W(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else if(i.depthTexture.format===1027)W(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else throw Error(`THREE.WebGLTextures: Unknown depthTexture format.`)}function ye(t){let i=r.get(t),a=t.isWebGLCubeRenderTarget===!0;if(i.__boundDepthTexture!==t.depthTexture){let e=t.depthTexture;if(i.__depthDisposeCallback&&i.__depthDisposeCallback(),e){let t=()=>{delete i.__boundDepthTexture,delete i.__depthDisposeCallback,e.removeEventListener(`dispose`,t)};e.addEventListener(`dispose`,t),i.__depthDisposeCallback=t}i.__boundDepthTexture=e}if(t.depthTexture&&!i.__autoAllocateDepthBuffer){if(a)for(let e=0;e<6;e++)_e(i.__webglFramebuffer[e],t,e);else{let e=t.texture.mipmaps;e&&e.length>0?_e(i.__webglFramebuffer[0],t,0):_e(i.__webglFramebuffer,t,0)}}else if(a){i.__webglDepthbuffer=[];for(let r=0;r<6;r++)if(n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[r]),i.__webglDepthbuffer[r]===void 0)i.__webglDepthbuffer[r]=e.createRenderbuffer(),ge(i.__webglDepthbuffer[r],t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,a=i.__webglDepthbuffer[r];e.bindRenderbuffer(e.RENDERBUFFER,a),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,a)}}else{let r=t.texture.mipmaps;if(r&&r.length>0?n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer),i.__webglDepthbuffer===void 0)i.__webglDepthbuffer=e.createRenderbuffer(),ge(i.__webglDepthbuffer,t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,r=i.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,r),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,r)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function xe(t,n,i){let a=r.get(t);n!==void 0&&he(a.__webglFramebuffer,t,t.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),i!==void 0&&ye(t)}function Se(t){let i=t.texture,s=r.get(t),c=r.get(i);t.addEventListener(`dispose`,k);let l=t.textures,u=t.isWebGLCubeRenderTarget===!0,d=l.length>1;if(d||(c.__webglTexture===void 0&&(c.__webglTexture=e.createTexture()),c.__version=i.version,o.memory.textures++),u){s.__webglFramebuffer=[];for(let t=0;t<6;t++)if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer[t]=[];for(let n=0;n<i.mipmaps.length;n++)s.__webglFramebuffer[t][n]=e.createFramebuffer()}else s.__webglFramebuffer[t]=e.createFramebuffer()}else{if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer=[];for(let t=0;t<i.mipmaps.length;t++)s.__webglFramebuffer[t]=e.createFramebuffer()}else s.__webglFramebuffer=e.createFramebuffer();if(d)for(let t=0,n=l.length;t<n;t++){let n=r.get(l[t]);n.__webglTexture===void 0&&(n.__webglTexture=e.createTexture(),o.memory.textures++)}if(t.samples>0&&W(t)===!1){s.__webglMultisampledFramebuffer=e.createFramebuffer(),s.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer);for(let n=0;n<l.length;n++){let r=l[n];s.__webglColorRenderbuffer[n]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,s.__webglColorRenderbuffer[n]);let i=a.convert(r.format,r.colorSpace),o=a.convert(r.type),c=w(r.internalFormat,i,o,r.normalized,r.colorSpace,t.isXRRenderTarget===!0),u=De(t);e.renderbufferStorageMultisample(e.RENDERBUFFER,u,c,t.width,t.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+n,e.RENDERBUFFER,s.__webglColorRenderbuffer[n])}e.bindRenderbuffer(e.RENDERBUFFER,null),t.depthBuffer&&(s.__webglDepthRenderbuffer=e.createRenderbuffer(),ge(s.__webglDepthRenderbuffer,t,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(u){n.bindTexture(e.TEXTURE_CUBE_MAP,c.__webglTexture),V(e.TEXTURE_CUBE_MAP,i);for(let n=0;n<6;n++)if(i.mipmaps&&i.mipmaps.length>0)for(let r=0;r<i.mipmaps.length;r++)he(s.__webglFramebuffer[n][r],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,r);else he(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0);x(i)&&S(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(d){for(let i=0,a=l.length;i<a;i++){let a=l[i],o=r.get(a),c=e.TEXTURE_2D;(t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(c=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(c,o.__webglTexture),V(c,a),he(s.__webglFramebuffer,t,a,e.COLOR_ATTACHMENT0+i,c,0),x(a)&&S(c)}n.unbindTexture()}else{let r=e.TEXTURE_2D;if((t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(r=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(r,c.__webglTexture),V(r,i),i.mipmaps&&i.mipmaps.length>0)for(let n=0;n<i.mipmaps.length;n++)he(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,r,n);else he(s.__webglFramebuffer,t,i,e.COLOR_ATTACHMENT0,r,0);x(i)&&S(r),n.unbindTexture()}t.depthBuffer&&ye(t)}function Ce(e){let t=e.textures;for(let i=0,a=t.length;i<a;i++){let a=t[i];if(x(a)){let t=C(e),i=r.get(a).__webglTexture;n.bindTexture(t,i),S(t),n.unbindTexture()}}}let we=[],U=[];function Ee(t){if(t.samples>0){if(W(t)===!1){let i=t.textures,a=t.width,o=t.height,s=e.COLOR_BUFFER_BIT,l=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,u=r.get(t),d=i.length>1;if(d)for(let t=0;t<i.length;t++)n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,u.__webglMultisampledFramebuffer);let f=t.texture.mipmaps;f&&f.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer);for(let n=0;n<i.length;n++){if(t.resolveDepthBuffer&&(t.depthBuffer&&(s|=e.DEPTH_BUFFER_BIT),t.stencilBuffer&&t.resolveStencilBuffer&&(s|=e.STENCIL_BUFFER_BIT)),d){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,u.__webglColorRenderbuffer[n]);let t=r.get(i[n]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0)}e.blitFramebuffer(0,0,a,o,0,0,a,o,s,e.NEAREST),c===!0&&(we.length=0,U.length=0,we.push(e.COLOR_ATTACHMENT0+n),t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&(we.push(l),U.push(l),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,U)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,we))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),d)for(let t=0;t<i.length;t++){n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,u.__webglColorRenderbuffer[t]);let a=r.get(i[t]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,a,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglMultisampledFramebuffer)}else if(t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&c){let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[n])}}}function De(e){return Math.min(i.maxSamples,e.samples)}function W(e){let n=r.get(e);return e.samples>0&&t.has(`WEBGL_multisampled_render_to_texture`)===!0&&n.__useRenderToTexture!==!1}function Oe(e){let t=o.render.frame;u.get(e)!==t&&(u.set(e,t),e.update())}function ke(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(Re.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&I(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):d(`WebGLTextures: Unsupported texture color space:`,n)),t}function Ae(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(l.width=e.naturalWidth||e.width,l.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(l.width=e.displayWidth,l.height=e.displayHeight):(l.width=e.width,l.height=e.height),l}this.allocateTextureUnit=F,this.resetTextureUnits=ee,this.getTextureUnits=te,this.setTextureUnits=re,this.setTexture2D=R,this.setTexture2DArray=z,this.setTexture3D=oe,this.setTextureCube=se,this.rebindTextures=xe,this.setupRenderTarget=Se,this.updateRenderTargetMipmap=Ce,this.updateMultisampleRenderTarget=Ee,this.setupDepthRenderbuffer=ye,this.setupFrameBufferTexture=he,this.useMultisampledRTT=W,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function Kr(e,t){function n(n,r=``){let i,a=Re.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779){if(a===`srgb`){if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null}else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null}if(n===35840||n===35841||n===35842||n===35843){if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null}if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491){if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null}if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821){if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null}if(n===36492||n===36494||n===36495){if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null}if(n===36283||n===36284||n===36285||n===36286){if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null}return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var qr=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Jr=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Yr=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new l(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new me({vertexShader:qr,fragmentShader:Jr,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new U(new he(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Xr=class extends w{constructor(e,a){super();let o=this,s=null,c=1,u=null,d=`local-floor`,f=1,p=null,h=null,g=null,_=null,v=null,x=null,w=typeof XRWebGLBinding<`u`,T=new Yr,E={},D=a.getContextAttributes(),O=null,A=null,j=[],M=[],N=new m,ee=null,ne=null,P=new W;P.viewport=new k;let re=new W;re.viewport=new k;let ie=[P,re],F=new G,ae=null,L=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=j[e];return t===void 0&&(t=new te,j[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=j[e];return t===void 0&&(t=new te,j[e]=t),t.getGripSpace()},this.getHand=function(e){let t=j[e];return t===void 0&&(t=new te,j[e]=t),t.getHandSpace()};function R(e){let t=M.indexOf(e.inputSource);if(t===-1)return;let n=j[t];n!==void 0&&(n.update(e.inputSource,e.frame,p||u),n.dispatchEvent({type:e.type,data:e.inputSource}))}function z(){s.removeEventListener(`select`,R),s.removeEventListener(`selectstart`,R),s.removeEventListener(`selectend`,R),s.removeEventListener(`squeeze`,R),s.removeEventListener(`squeezestart`,R),s.removeEventListener(`squeezeend`,R),s.removeEventListener(`end`,z),s.removeEventListener(`inputsourceschange`,oe);for(let e=0;e<j.length;e++){let t=M[e];t!==null&&(M[e]=null,j[e].disconnect(t))}ae=null,L=null,T.reset();for(let e in E)delete E[e];if(e.setRenderTarget(O),v=null,_=null,g=null,s=null,A=null,H.stop(),o.isPresenting=!1,e.setPixelRatio(ee),e.setSize(N.width,N.height,!1),ne!==null){let e=ne.camera;e.fov=ne.fov,e.zoom=ne.zoom,e.updateProjectionMatrix(),ne=null}o.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){c=e,o.isPresenting===!0&&I(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){d=e,o.isPresenting===!0&&I(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return p||u},this.setReferenceSpace=function(e){p=e},this.getBaseLayer=function(){return _===null?v:_},this.getBinding=function(){return g===null&&w&&(g=new XRWebGLBinding(s,a)),g},this.getFrame=function(){return x},this.getSession=function(){return s},this.setSession=async function(l){if(s=l,s!==null){if(O=e.getRenderTarget(),s.addEventListener(`select`,R),s.addEventListener(`selectstart`,R),s.addEventListener(`selectend`,R),s.addEventListener(`squeeze`,R),s.addEventListener(`squeezestart`,R),s.addEventListener(`squeezeend`,R),s.addEventListener(`end`,z),s.addEventListener(`inputsourceschange`,oe),D.xrCompatible!==!0&&await a.makeXRCompatible(),ee=e.getPixelRatio(),e.getSize(N),w&&`createProjectionLayer`in XRWebGLBinding.prototype){let o=null,l=null,u=null;D.depth&&(u=D.stencil?a.DEPTH24_STENCIL8:a.DEPTH_COMPONENT24,o=D.stencil?ve:S,l=D.stencil?n:b);let d={colorFormat:a.RGBA8,depthFormat:u,scaleFactor:c};g=this.getBinding(),_=g.createProjectionLayer(d),s.updateRenderState({layers:[_]}),e.setPixelRatio(1),e.setSize(_.textureWidth,_.textureHeight,!1),A=new r(_.textureWidth,_.textureHeight,{format:i,type:C,depthTexture:new t(_.textureWidth,_.textureHeight,l,void 0,void 0,void 0,void 0,void 0,void 0,o),stencilBuffer:D.stencil,colorSpace:e.outputColorSpace,samples:D.antialias?4:0,resolveDepthBuffer:_.ignoreDepthValues===!1,resolveStencilBuffer:_.ignoreDepthValues===!1,storeMultisampledDepthBuffer:_.ignoreDepthValues===!1,storeMultisampledStencilBuffer:_.ignoreDepthValues===!1})}else{let t={antialias:D.antialias,alpha:!0,depth:D.depth,stencil:D.stencil,framebufferScaleFactor:c};v=new XRWebGLLayer(s,a,t),s.updateRenderState({baseLayer:v}),e.setPixelRatio(1),e.setSize(v.framebufferWidth,v.framebufferHeight,!1),A=new r(v.framebufferWidth,v.framebufferHeight,{format:i,type:C,colorSpace:e.outputColorSpace,stencilBuffer:D.stencil,resolveDepthBuffer:v.ignoreDepthValues===!1,resolveStencilBuffer:v.ignoreDepthValues===!1,storeMultisampledDepthBuffer:v.ignoreDepthValues===!1,storeMultisampledStencilBuffer:v.ignoreDepthValues===!1})}A.isXRRenderTarget=!0,this.setFoveation(f),p=null,u=await s.requestReferenceSpace(d),H.setContext(s),H.start(),o.isPresenting=!0,o.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return T.getDepthTexture()};function oe(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=M.indexOf(n);r>=0&&(M[r]=null,j[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=M.indexOf(n);if(r===-1){for(let e=0;e<j.length;e++)if(e>=M.length){M.push(n),r=e;break}else if(M[e]===null){M[e]=n,r=e;break}if(r===-1)break}let i=j[r];i&&i.connect(n)}}let se=new y,ce=new y;function le(e,t,n){se.setFromMatrixPosition(t.matrixWorld),ce.setFromMatrixPosition(n.matrixWorld);let r=se.distanceTo(ce),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function B(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(s===null)return;let t=e.near,n=e.far;T.texture!==null&&(T.depthNear>0&&(t=T.depthNear),T.depthFar>0&&(n=T.depthFar)),F.near=re.near=P.near=t,F.far=re.far=P.far=n,(ae!==F.near||L!==F.far)&&(s.updateRenderState({depthNear:F.near,depthFar:F.far}),ae=F.near,L=F.far),F.layers.mask=e.layers.mask|6,P.layers.mask=F.layers.mask&-5,re.layers.mask=F.layers.mask&-3;let r=e.parent,i=F.cameras;B(F,r);for(let e=0;e<i.length;e++)B(i[e],r);i.length===2?le(F,P,re):F.projectionMatrix.copy(P.projectionMatrix),ne===null&&e.isPerspectiveCamera&&(ne={camera:e,fov:e.fov,zoom:e.zoom}),ue(e,F,r)};function ue(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=ze*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return F},this.getFoveation=function(){if(_!==null||v!==null)return f},this.setFoveation=function(e){f=e,_!==null&&(_.fixedFoveation=e),v!==null&&v.fixedFoveation!==void 0&&(v.fixedFoveation=e)},this.hasDepthSensing=function(){return T.texture!==null},this.getDepthSensingMesh=function(){return T.getMesh(F)},this.getCameraTexture=function(e){return E[e]};let V=null;function de(t,n){if(h=n.getViewerPose(p||u),x=n,h!==null){let t=h.views;v!==null&&(e.setRenderTargetFramebuffer(A,v.framebuffer),e.setRenderTarget(A));let n=!1;t.length!==F.cameras.length&&(F.cameras.length=0,n=!0);for(let r=0;r<t.length;r++){let i=t[r],a=null;if(v!==null)a=v.getViewport(i);else{let t=g.getViewSubImage(_,i);a=t.viewport,r===0&&(e.setRenderTargetTextures(A,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(A))}let o=ie[r];o===void 0&&(o=new W,o.layers.enable(r),o.viewport=new k,ie[r]=o),o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(i.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),r===0&&(F.matrix.copy(o.matrix),F.matrix.decompose(F.position,F.quaternion,F.scale)),n===!0&&F.cameras.push(o)}let r=s.enabledFeatures;if(r&&r.includes(`depth-sensing`)&&s.depthUsage==`gpu-optimized`&&w){g=o.getBinding();let e=g.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&T.init(e,s.renderState)}if(r&&r.includes(`camera-access`)&&w){e.state.unbindTexture(),g=o.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=E[n];e||(e=new l,E[n]=e);let t=g.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<j.length;e++){let t=M[e],r=j[e];t!==null&&r!==void 0&&r.update(t,n,p||u)}V&&V(t,n),n.detectedPlanes&&o.dispatchEvent({type:`planesdetected`,data:n}),x=null}let H=new He;H.setAnimationLoop(de),this.setAnimationLoop=function(e){V=e},this.dispose=function(){}}},Zr=new Pe,Qr=new H;Qr.set(-1,0,0,0,1,0,0,0,1);function $r(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,ke(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(Zr.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(Qr),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.retroreflectivity>0&&(e.retroreflectivity.value=t.retroreflectivity),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function ei(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(_(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,y));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(p(e),a[e.id]=c)}function u(t){let n=f();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function f(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return d(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function p(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let e=0,t=r.length;e<t;e++){let t=r[e];if(Array.isArray(t))for(let n=0,r=t.length;n<r;n++)m(t[n],e,n,a);else m(t,e,0,a)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function m(t,n,r,i){if(g(t,n,r,i)===!0){let n=t.__offset,r=t.value;if(Array.isArray(r)){let e=0;for(let n=0;n<r.length;n++){let i=r[n],a=v(i);h(i,t.__data,e),typeof i!=`number`&&typeof i!=`boolean`&&!i.isMatrix3&&!ArrayBuffer.isView(i)&&(e+=a.storage/Float32Array.BYTES_PER_ELEMENT)}}else h(r,t.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,n,t.__data)}}function h(e,t,n){typeof e==`number`||typeof e==`boolean`?t[0]=e:e.isMatrix3?(t[0]=e.elements[0],t[1]=e.elements[1],t[2]=e.elements[2],t[3]=0,t[4]=e.elements[3],t[5]=e.elements[4],t[6]=e.elements[5],t[7]=0,t[8]=e.elements[6],t[9]=e.elements[7],t[10]=e.elements[8],t[11]=0):ArrayBuffer.isView(e)?t.set(new e.constructor(e.buffer,e.byteOffset,t.length)):e.toArray(t,n)}function g(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return r[a]=typeof i==`number`||typeof i==`boolean`?i:ArrayBuffer.isView(i)?i.slice():i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function _(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=v(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function v(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?I(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):I(`WebGLRenderer: Unsupported uniform value type.`,e),t}function y(t){let n=t.target;n.removeEventListener(`dispose`,y);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function b(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:b}}var ti=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),ni=null;function ri(){return ni===null&&(ni=new s(ti,16,16,de,f),ni.name=`DFG_LUT`,ni.minFilter=h,ni.magFilter=h,ni.wrapS=L,ni.wrapT=L,ni.generateMipmaps=!1,ni.needsUpdate=!0),ni}var ii=class{constructor(e={}){let{canvas:t=ee(),context:i=null,depth:a=!0,stencil:o=!1,alpha:s=!1,antialias:c=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:p=!1,powerPreference:m=`default`,failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:_=!1,outputBufferType:v=C}=e;this.isWebGLRenderer=!0;let S;if(i!==null){if(typeof WebGLRenderingContext<`u`&&i instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);S=i.getContextAttributes().alpha}else S=s;let w=v,E=new Set([Le,Ne,oe]),D=new Set([C,b,u,n,x,T]),O=new Uint32Array(4),A=new Int32Array(4),j=new y,M=null,N=null,te=[],ne=[],P=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let F=this,ae=!1,L=null,R=null,z=null,se=null;this._outputColorSpace=pe;let ce=0,le=0,B=null,ue=-1,V=null,de=new k,H=new k,fe=null,me=new q(0),he=0,ge=t.width,_e=t.height,ve=1,ye=null,be=null,xe=new k(0,0,ge,_e),Se=new k(0,0,ge,_e),Ce=!1,we=new Be,U=!1,Te=!1,Ee=new Pe,De=new y,W=new k,Oe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ke=!1;function Ae(){return B===null?ve:1}let G=i;function je(e,n){return t.getContext(e,n)}let Me,Fe,K,Ie,J,Y,ze,X,Z,We,Ge,Ke,qe,$e,et,tt,nt,rt,it,at,ot,st,ct;try{let e={alpha:!0,depth:a,stencil:o,antialias:c,premultipliedAlpha:l,preserveDrawingBuffer:p,powerPreference:m,failIfMajorPerformanceCaveat:h};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r186`),t.addEventListener(`webglcontextlost`,ut,!1),t.addEventListener(`webglcontextrestored`,dt,!1),t.addEventListener(`webglcontextcreationerror`,ft,!1),G===null){let t=`webgl2`;if(G=je(t,e),G===null)throw je(t)?Error(`THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.`):Error(`THREE.WebGLRenderer: Error creating WebGL context.`)}lt()}catch(e){throw t.removeEventListener(`webglcontextlost`,ut,!1),t.removeEventListener(`webglcontextrestored`,dt,!1),t.removeEventListener(`webglcontextcreationerror`,ft,!1),d(`WebGLRenderer: `+e.message),e}function lt(){Me=new xt(G),Me.init(),ot=new Kr(G,Me),Fe=new Ze(G,Me,e,ot),K=new Wr(G,Me),Fe.reversedDepthBuffer&&_&&K.buffers.depth.setReversed(!0),R=G.createFramebuffer(),z=G.createFramebuffer(),se=G.createFramebuffer(),Ie=new wt(G),J=new wr,Y=new Gr(G,Me,K,J,Fe,ot,Ie),ze=new bt(F),X=new Ue(G),st=new Ye(G,X),Z=new St(G,X,Ie,st),We=new Et(G,Z,X,st,Ie),rt=new Tt(G,Fe,Y),et=new Qe(J),Ge=new Cr(F,ze,Me,Fe,st,et),Ke=new $r(F,J),qe=new Or,$e=new Fr(Me),nt=new Je(F,ze,K,We,S,l),tt=new Ur(F,We,Fe),ct=new ei(G,Ie,Fe,K),it=new Xe(G,Me,Ie),at=new Ct(G,Me,Ie),Ie.programs=Ge.programs,F.capabilities=Fe,F.extensions=Me,F.properties=J,F.renderLists=qe,F.shadowMap=tt,F.state=K,F.info=Ie}w!==1009&&(P=new Ot(w,t.width,t.height,c,a,o));let Q=new Xr(F,G);this.xr=Q,this.getContext=function(){return G},this.getContextAttributes=function(){return G.getContextAttributes()},this.forceContextLoss=function(){let e=Me.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=Me.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return ve},this.setPixelRatio=function(e){e!==void 0&&(ve=e,this.setSize(ge,_e,!1))},this.getSize=function(e){return e.set(ge,_e)},this.setSize=function(e,n,r=!0){if(Q.isPresenting){I(`WebGLRenderer: Can't change size while VR device is presenting.`);return}ge=e,_e=n,t.width=Math.floor(e*ve),t.height=Math.floor(n*ve),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),P!==null&&P.setSize(t.width,t.height),this.setViewport(0,0,e,n)},this.getDrawingBufferSize=function(e){return e.set(ge*ve,_e*ve).floor()},this.setDrawingBufferSize=function(e,n,r){ge=e,_e=n,ve=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(w===1009){d(`WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);return}if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){I(`WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}P.setEffects(e||[])},this.getCurrentViewport=function(e){return e.copy(de)},this.getViewport=function(e){return e.copy(xe)},this.setViewport=function(e,t,n,r){e.isVector4?xe.set(e.x,e.y,e.z,e.w):xe.set(e,t,n,r),K.viewport(de.copy(xe).multiplyScalar(ve).round())},this.getScissor=function(e){return e.copy(Se)},this.setScissor=function(e,t,n,r){e.isVector4?Se.set(e.x,e.y,e.z,e.w):Se.set(e,t,n,r),K.scissor(H.copy(Se).multiplyScalar(ve).round())},this.getScissorTest=function(){return Ce},this.setScissorTest=function(e){K.setScissorTest(Ce=e)},this.setOpaqueSort=function(e){ye=e},this.setTransparentSort=function(e){be=e},this.getClearColor=function(e){return e.copy(nt.getClearColor())},this.setClearColor=function(){nt.setClearColor(...arguments)},this.getClearAlpha=function(){return nt.getClearAlpha()},this.setClearAlpha=function(){nt.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(B!==null){let t=B.texture.format;e=E.has(t)}if(e){let e=B.texture.type,t=D.has(e),n=nt.getClearColor(),r=nt.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(O[0]=i,O[1]=a,O[2]=o,O[3]=r,G.clearBufferuiv(G.COLOR,0,O)):(A[0]=i,A[1]=a,A[2]=o,A[3]=r,G.clearBufferiv(G.COLOR,0,A))}else r|=G.COLOR_BUFFER_BIT}t&&(r|=G.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=G.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&G.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),L=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,ut,!1),t.removeEventListener(`webglcontextrestored`,dt,!1),t.removeEventListener(`webglcontextcreationerror`,ft,!1),nt.dispose(),qe.dispose(),$e.dispose(),J.dispose(),ze.dispose(),We.dispose(),st.dispose(),ct.dispose(),Ge.dispose(),Q.dispose(),Q.removeEventListener(`sessionstart`,yt),Q.removeEventListener(`sessionend`,Dt),kt.stop()};function ut(e){e.preventDefault(),g(`WebGLRenderer: Context Lost.`),ae=!0}function dt(){g(`WebGLRenderer: Context Restored.`),ae=!1;let e=Ie.autoReset,t=tt.enabled,n=tt.autoUpdate,r=tt.needsUpdate,i=tt.type;lt(),Ie.autoReset=e,tt.enabled=t,tt.autoUpdate=n,tt.needsUpdate=r,tt.type=i}function ft(e){d(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function pt(e){let t=e.target;t.removeEventListener(`dispose`,pt),mt(t)}function mt(e){ht(e),J.remove(e)}function ht(e){let t=J.get(e).programs;t!==void 0&&(t.forEach(function(e){Ge.releaseProgram(e)}),e.isShaderMaterial&&Ge.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=Oe);let o=i.isMesh&&i.matrixWorld.determinantAffine()<0,s=zt(e,t,n,r,i);K.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=Z.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;st.setup(i,r,s,n,c);let h,g=it;if(c!==null&&(h=X.get(c),g=at,g.setIndex(h)),i.isMesh)r.wireframe===!0?(K.setLineWidth(r.wireframeLinewidth*Ae()),g.setMode(G.LINES)):g.setMode(G.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),K.setLineWidth(e*Ae()),i.isLineSegments?g.setMode(G.LINES):i.isLineLoop?g.setMode(G.LINE_LOOP):g.setMode(G.LINE_STRIP)}else i.isPoints?g.setMode(G.POINTS):i.isSprite&&g.setMode(G.TRIANGLES);if(i.isBatchedMesh){if(Me.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?X.get(c).bytesPerElement:1,o=J.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(G,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function gt(e,t,n,r){L!==null&&e.isNodeMaterial&&L.setObject(r,e),U===!0&&et.setState(e,n,!1),e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,Ft(e,t,r),e.side=0,e.needsUpdate=!0,Ft(e,t,r),e.side=2):Ft(e,t,r)}this.compile=function(e,t,n=null){n===null&&(n=e),L!==null&&L.renderStart(e,t,n),N=$e.get(n),N.init(t),ne.push(N),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(N.pushLight(e),e.castShadow&&N.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(N.pushLight(e),e.castShadow&&N.pushShadow(e))}),N.setupLights(),L!==null&&L.updateLights(N.state.lightsArray),Te=this.localClippingEnabled,U=et.init(this.clippingPlanes,Te),U===!0&&et.setGlobalState(this.clippingPlanes,t),L!==null&&tt.render(N.state.shadowsArray,n,t);let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let i=e.material;if(i){if(Array.isArray(i))for(let a=0;a<i.length;a++){let o=i[a];gt(o,n,t,e),r.add(o)}else gt(i,n,t,e),r.add(i)}}),N=ne.pop(),L!==null&&L.renderEnd(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){if(r.forEach(function(e){let t=J.get(e).currentProgram;(t===void 0||t.isReady())&&r.delete(e)}),r.size===0){t(e);return}setTimeout(n,10)}Me.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let _t=null;function vt(e){_t&&_t(e)}function yt(){kt.stop()}function Dt(){kt.start()}let kt=new He;kt.setAnimationLoop(vt),typeof self<`u`&&kt.setContext(self),this.setAnimationLoop=function(e){_t=e,Q.setAnimationLoop(e),e===null?kt.stop():kt.start()},Q.addEventListener(`sessionstart`,yt),Q.addEventListener(`sessionend`,Dt),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){d(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(ae===!0)return;L!==null&&L.renderStart(e,t);let n=Q.enabled===!0&&Q.isPresenting===!0,r=P!==null&&(B===null||n)&&P.begin(F,B);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),Q.enabled===!0&&Q.isPresenting===!0&&(P===null||P.isCompositing()===!1)&&(Q.cameraAutoUpdate===!0&&Q.updateCamera(t),t=Q.getCamera()),e.isScene===!0&&e.onBeforeRender(F,e,t,B),N=$e.get(e,ne.length),N.init(t),N.state.textureUnits=Y.getTextureUnits(),ne.push(N),Ee.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),we.setFromProjectionMatrix(Ee,Ve,t.reversedDepth),Te=this.localClippingEnabled,U=et.init(this.clippingPlanes,Te),M=qe.get(e,te.length),M.init(),te.push(M),Q.enabled===!0&&Q.isPresenting===!0){let e=F.xr.getDepthSensingMesh();e!==null&&At(e,t,-1/0,F.sortObjects)}At(e,t,0,F.sortObjects),M.finish(),L!==null&&L.updateLights(N.state.lightsArray),F.sortObjects===!0&&M.sort(ye,be),ke=Q.enabled===!1||Q.isPresenting===!1||Q.hasDepthSensing()===!1,ke&&nt.addToRenderList(M,e),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),U===!0&&et.beginShadows();let i=N.state.shadowsArray;if(tt.render(i,e,t),U===!0&&et.endShadows(),(r&&P.hasRenderPass())===!1){let n=M.opaque,r=M.transmissive;if(N.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];Mt(n,r,e,a)}ke&&nt.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];jt(M,e,n,n.viewport)}}else r.length>0&&Mt(n,r,e,t),ke&&nt.render(e),jt(M,e,t)}B!==null&&le===0&&(Y.updateMultisampleRenderTarget(B),Y.updateRenderTargetMipmap(B)),r&&P.end(F),e.isScene===!0&&e.onAfterRender(F,e,t),st.resetDefaultState(),ue=-1,V=null,ne.pop(),ne.length>0?(N=ne[ne.length-1],Y.setTextureUnits(N.state.textureUnits),U===!0&&et.setGlobalState(F.clippingPlanes,N.state.camera)):N=null,te.pop(),M=te.length>0?te[te.length-1]:null,L!==null&&L.renderEnd()};function At(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)N.pushLightProbeGrid(e);else if(e.isLight)N.pushLight(e),e.castShadow&&N.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||e.intersectsFrustum(we)){r&&W.setFromMatrixPosition(e.matrixWorld).applyMatrix4(Ee);let i=We.update(e),a=e.material;a.visible&&M.push(e,i,a,n,W.z,null,t)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||e.intersectsFrustum(we))){let i=We.update(e),a=e.material;if(r&&(e.boundingSphere===void 0?(i.boundingSphere===null&&i.computeBoundingSphere(),W.copy(i.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),W.copy(e.boundingSphere.center)),W.applyMatrix4(e.matrixWorld).applyMatrix4(Ee)),Array.isArray(a)){let r=i.groups;for(let o=0,s=r.length;o<s;o++){let s=r[o],c=a[s.materialIndex];c&&c.visible&&M.push(e,i,c,n,W.z,s,t)}}else a.visible&&M.push(e,i,a,n,W.z,null,t)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)At(i[e],t,n,r)}function jt(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;N.setupLightsView(n),U===!0&&et.setGlobalState(F.clippingPlanes,n),r&&K.viewport(de.copy(r)),i.length>0&&Nt(i,t,n),a.length>0&&Nt(a,t,n),o.length>0&&Nt(o,t,n),K.buffers.depth.setTest(!0),K.buffers.depth.setMask(!0),K.buffers.color.setMask(!0),K.setPolygonOffset(!1)}function Mt(e,t,n,i){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(N.state.transmissionRenderTarget[i.id]===void 0){let e=Me.has(`EXT_color_buffer_half_float`)||Me.has(`EXT_color_buffer_float`);N.state.transmissionRenderTarget[i.id]=new r(1,1,{generateMipmaps:!0,type:e?f:C,minFilter:ie,samples:Math.max(4,Fe.samples),stencilBuffer:o,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Re.workingColorSpace})}let a=N.state.transmissionRenderTarget[i.id],s=i.viewport||de;a.setSize(s.z*F.transmissionResolutionScale,s.w*F.transmissionResolutionScale);let c=F.getRenderTarget(),l=F.getActiveCubeFace(),u=F.getActiveMipmapLevel();F.setRenderTarget(a),F.getClearColor(me),he=F.getClearAlpha(),he<1&&F.setClearColor(16777215,.5),F.clear(),ke&&nt.render(n);let d=F.toneMapping;F.toneMapping=0;let p=i.viewport;if(i.viewport!==void 0&&(i.viewport=void 0),N.setupLightsView(i),U===!0&&et.setGlobalState(F.clippingPlanes,i),Nt(e,n,i),Y.updateMultisampleRenderTarget(a),Y.updateRenderTargetMipmap(a),Me.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let r=0,a=t.length;r<a;r++){let{object:a,geometry:o,material:s,group:c}=t[r];if(s.side===2&&a.layers.test(i.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,Pt(a,n,i,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(Y.updateMultisampleRenderTarget(a),Y.updateRenderTargetMipmap(a))}F.setRenderTarget(c,l,u),F.setClearColor(me,he),p!==void 0&&(i.viewport=p),F.toneMapping=d}function Nt(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&Pt(o,t,n,s,l,c)}}function Pt(e,t,n,r,i,a){L!==null&&i.isNodeMaterial&&L.setObject(e,i),e.onBeforeRender(F,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(F,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,F.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,F.renderBufferDirect(n,t,r,i,e,a),i.side=2):F.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(F,t,n,r,i,a)}function Ft(e,t,n){t.isScene!==!0&&(t=Oe);let r=J.get(e),i=N.state.lights,a=N.state.shadowsArray,o=i.state.version,s=Ge.getParameters(e,i.state,a,t,n,N.state.lightProbeGridArray),c=Ge.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=ze.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,pt),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return Lt(e,s),d}else s.uniforms=Ge.getUniforms(e),L!==null&&e.isNodeMaterial&&L.build(e,n,s),e.onBeforeCompile(s,F),d=Ge.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=et.uniform),Lt(e,s),r.needsLights=Vt(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.sunLights.value=i.state.sun,f.sunLightShadows.value=i.state.sunShadow,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.sunShadowMatrix.value=i.state.sunShadowMatrix,f.sunShadowCascade.value=i.state.sunShadowCascade,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=N.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function It(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=In.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function Lt(e,t){let n=J.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function Rt(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];j.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(j))return n}return null}function zt(e,t,n,r,i){t.isScene!==!0&&(t=Oe),Y.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=B===null?F.outputColorSpace:B.isXRRenderTarget===!0?B.texture.colorSpace:Re.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=ze.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(B===null||B.isXRRenderTarget===!0)&&(h=F.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=J.get(r),y=N.state.lights;if(U===!0&&(Te===!0||e!==V)){let t=e===V&&r.id===ue;et.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i._colorsTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i._colorsTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==et.numPlanes||v.numIntersection!==et.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=N.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let x=v.currentProgram;b===!0&&(x=Ft(r,t,i),L&&r.isNodeMaterial&&L.onUpdateProgram(r,x,v));let S=!1,C=!1,w=!1,T=x.getUniforms(),E=v.uniforms;if(K.useProgram(x.program)&&(S=!0,C=!0,w=!0),r.id!==ue&&(ue=r.id,C=!0),v.needsLights){let e=Rt(N.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,C=!0)}if(S||V!==e){K.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),T.setValue(G,`projectionMatrix`,e.projectionMatrix),T.setValue(G,`viewMatrix`,e.matrixWorldInverse);let t=T.map.cameraPosition;t!==void 0&&t.setValue(G,De.setFromMatrixPosition(e.matrixWorld)),Fe.logarithmicDepthBuffer&&T.setValue(G,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&T.setValue(G,`isOrthographic`,e.isOrthographicCamera===!0),V!==e&&(V=e,C=!0,w=!0)}if(v.needsLights&&(y.state.sunShadowMap.length>0&&T.setValue(G,`sunShadowMap`,y.state.sunShadowMap,Y),y.state.directionalShadowMap.length>0&&T.setValue(G,`directionalShadowMap`,y.state.directionalShadowMap,Y),y.state.spotShadowMap.length>0&&T.setValue(G,`spotShadowMap`,y.state.spotShadowMap,Y),y.state.pointShadowMap.length>0&&T.setValue(G,`pointShadowMap`,y.state.pointShadowMap,Y)),i.isSkinnedMesh){T.setOptional(G,i,`bindMatrix`),T.setOptional(G,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),T.setValue(G,`boneTexture`,e.boneTexture,Y))}i.isBatchedMesh&&(T.setOptional(G,i,`batchingTexture`),T.setValue(G,`batchingTexture`,i._matricesTexture,Y),T.setOptional(G,i,`batchingIdTexture`),T.setValue(G,`batchingIdTexture`,i._indirectTexture,Y),T.setOptional(G,i,`batchingColorTexture`),i._colorsTexture!==null&&T.setValue(G,`batchingColorTexture`,i._colorsTexture,Y));let D=n.morphAttributes;if((D.position!==void 0||D.normal!==void 0||D.color!==void 0)&&rt.update(i,n,x),(C||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,T.setValue(G,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(E.envMapIntensity.value=t.environmentIntensity),E.dfgLUT!==void 0&&(E.dfgLUT.value=ri()),C){if(T.setValue(G,`toneMappingExposure`,F.toneMappingExposure),v.needsLights&&Bt(E,w),a&&r.fog===!0&&Ke.refreshFogUniforms(E,a),Ke.refreshMaterialUniforms(E,r,ve,_e,N.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;E.probesSH.value=e.texture,E.probesMin.value.copy(e.boundingBox.min),E.probesMax.value.copy(e.boundingBox.max),E.probesResolution.value.copy(e.resolution)}In.upload(G,It(v),E,Y)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(In.upload(G,It(v),E,Y),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&T.setValue(G,`center`,i.center),T.setValue(G,`modelViewMatrix`,i.modelViewMatrix),T.setValue(G,`normalMatrix`,i.normalMatrix),T.setValue(G,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];ct.update(n,x),ct.bind(n,x)}}return x}function Bt(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.sunLights.needsUpdate=t,e.sunLightShadows.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function Vt(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return ce},this.getActiveMipmapLevel=function(){return le},this.getRenderTarget=function(){return B},this.setRenderTargetTextures=function(e,t,n){let r=J.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),J.get(e.texture).__webglTexture=t,J.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=J.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0},this.setRenderTarget=function(e,t=0,n=0){B=e,ce=t,le=n;let r=null,i=!1,a=!1;if(e){let o=J.get(e);if(o.__useDefaultFramebuffer!==void 0){K.bindFramebuffer(G.FRAMEBUFFER,o.__webglFramebuffer),de.copy(e.viewport),H.copy(e.scissor),fe=e.scissorTest,K.viewport(de),K.scissor(H),K.setScissorTest(fe),ue=-1;return}if(o.__webglFramebuffer===void 0)Y.setupRenderTarget(e);else if(o.__hasExternalTextures)Y.rebindTextures(e,J.get(e.texture).__webglTexture,J.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&J.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.`);Y.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=J.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&Y.useMultisampledRTT(e)===!1?J.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,de.copy(e.viewport),H.copy(e.scissor),fe=e.scissorTest}else de.copy(xe).multiplyScalar(ve).floor(),H.copy(Se).multiplyScalar(ve).floor(),fe=Ce;if(n!==0&&(r=R),K.bindFramebuffer(G.FRAMEBUFFER,r)&&K.drawBuffers(e,r),K.viewport(de),K.scissor(H),K.setScissorTest(fe),i){let r=J.get(e.texture);G.framebufferTexture2D(G.FRAMEBUFFER,G.COLOR_ATTACHMENT0,G.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=J.get(e.textures[t]);G.framebufferTextureLayer(G.FRAMEBUFFER,G.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=J.get(e.texture);G.framebufferTexture2D(G.FRAMEBUFFER,G.COLOR_ATTACHMENT0,G.TEXTURE_2D,t.__webglTexture,n)}ue=-1};function Ht(e){let t=J.get(e);return(t.__readFormat!==e.format||t.__readType!==e.type)&&(t.__readFormat=e.format,t.__readType=e.type,t.__formatReadable=Fe.textureFormatReadable(e.format),t.__typeReadable=Fe.textureTypeReadable(e.type)),t}this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){d(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=J.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){K.bindFramebuffer(G.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;e.textures.length>1&&G.readBuffer(G.COLOR_ATTACHMENT0+s);let u=Ht(o);if(u.__formatReadable===!1){d(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(u.__typeReadable===!1){d(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&G.readPixels(t,n,r,i,ot.convert(c),ot.convert(l),a)}finally{let e=B===null?null:J.get(B).__webglFramebuffer;K.bindFramebuffer(G.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=J.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){K.bindFramebuffer(G.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;e.textures.length>1&&G.readBuffer(G.COLOR_ATTACHMENT0+s);let d=Ht(o);if(d.__formatReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(d.__typeReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let f=G.createBuffer();G.bindBuffer(G.PIXEL_PACK_BUFFER,f),G.bufferData(G.PIXEL_PACK_BUFFER,a.byteLength,G.STREAM_READ),G.readPixels(t,n,r,i,ot.convert(l),ot.convert(u),0),G.bindBuffer(G.PIXEL_PACK_BUFFER,null);let p=B===null?null:J.get(B).__webglFramebuffer;K.bindFramebuffer(G.FRAMEBUFFER,p);let m=G.fenceSync(G.SYNC_GPU_COMMANDS_COMPLETE,0);return G.flush(),await re(G,m,4),G.bindBuffer(G.PIXEL_PACK_BUFFER,f),G.getBufferSubData(G.PIXEL_PACK_BUFFER,0,a),G.bindBuffer(G.PIXEL_PACK_BUFFER,null),G.deleteBuffer(f),G.deleteSync(m),a}throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)}},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;Y.setTexture2D(e,0),G.copyTexSubImage2D(G.TEXTURE_2D,n,0,0,o,s,i,a),K.unbindTexture()},this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=ot.convert(t.format),_=ot.convert(t.type),v;t.isData3DTexture?(Y.setTexture3D(t,0),v=G.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(Y.setTexture2DArray(t,0),v=G.TEXTURE_2D_ARRAY):(Y.setTexture2D(t,0),v=G.TEXTURE_2D),K.activeTexture(G.TEXTURE0),K.pixelStorei(G.UNPACK_FLIP_Y_WEBGL,t.flipY),K.pixelStorei(G.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),K.pixelStorei(G.UNPACK_ALIGNMENT,t.unpackAlignment);let y=K.getParameter(G.UNPACK_ROW_LENGTH),b=K.getParameter(G.UNPACK_IMAGE_HEIGHT),x=K.getParameter(G.UNPACK_SKIP_PIXELS),S=K.getParameter(G.UNPACK_SKIP_ROWS),C=K.getParameter(G.UNPACK_SKIP_IMAGES);K.pixelStorei(G.UNPACK_ROW_LENGTH,h.width),K.pixelStorei(G.UNPACK_IMAGE_HEIGHT,h.height),K.pixelStorei(G.UNPACK_SKIP_PIXELS,l),K.pixelStorei(G.UNPACK_SKIP_ROWS,u),K.pixelStorei(G.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=J.get(e),r=J.get(t),h=J.get(n.__renderTarget),g=J.get(r.__renderTarget);K.bindFramebuffer(G.READ_FRAMEBUFFER,h.__webglFramebuffer),K.bindFramebuffer(G.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(G.framebufferTextureLayer(G.READ_FRAMEBUFFER,G.COLOR_ATTACHMENT0,J.get(e).__webglTexture,i,d+n),G.framebufferTextureLayer(G.DRAW_FRAMEBUFFER,G.COLOR_ATTACHMENT0,J.get(t).__webglTexture,a,m+n)),G.blitFramebuffer(l,u,o,s,f,p,o,s,G.DEPTH_BUFFER_BIT,G.NEAREST);K.bindFramebuffer(G.READ_FRAMEBUFFER,null),K.bindFramebuffer(G.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||J.has(e)){let n=J.get(e),r=J.get(t);K.bindFramebuffer(G.READ_FRAMEBUFFER,z),K.bindFramebuffer(G.DRAW_FRAMEBUFFER,se);for(let e=0;e<c;e++)w?G.framebufferTextureLayer(G.READ_FRAMEBUFFER,G.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):G.framebufferTexture2D(G.READ_FRAMEBUFFER,G.COLOR_ATTACHMENT0,G.TEXTURE_2D,n.__webglTexture,i),T?G.framebufferTextureLayer(G.DRAW_FRAMEBUFFER,G.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):G.framebufferTexture2D(G.DRAW_FRAMEBUFFER,G.COLOR_ATTACHMENT0,G.TEXTURE_2D,r.__webglTexture,a),i===0?T?G.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):G.copyTexSubImage2D(v,a,f,p,l,u,o,s):G.blitFramebuffer(l,u,o,s,f,p,o,s,G.COLOR_BUFFER_BIT,G.NEAREST);K.bindFramebuffer(G.READ_FRAMEBUFFER,null),K.bindFramebuffer(G.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?G.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?G.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):G.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?G.texSubImage2D(G.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?G.compressedTexSubImage2D(G.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):G.texSubImage2D(G.TEXTURE_2D,a,f,p,o,s,g,_,h);K.pixelStorei(G.UNPACK_ROW_LENGTH,y),K.pixelStorei(G.UNPACK_IMAGE_HEIGHT,b),K.pixelStorei(G.UNPACK_SKIP_PIXELS,x),K.pixelStorei(G.UNPACK_SKIP_ROWS,S),K.pixelStorei(G.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&G.generateMipmap(v),K.unbindTexture()},this.initRenderTarget=function(e){J.get(e).__webglFramebuffer===void 0&&Y.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?Y.setTextureCube(e,0):e.isData3DTexture?Y.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?Y.setTexture2DArray(e,0):Y.setTexture2D(e,0),K.unbindTexture()},this.resetState=function(){ce=0,le=0,B=null,K.reset(),st.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return Ve}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Re._getDrawingBufferColorSpace(e),t.unpackColorSpace=Re._getUnpackColorSpace()}},ai=class{boxes=[];add(e,t,n){let r={min:new y(Math.min(e.x,t.x),Math.min(e.y,t.y),Math.min(e.z,t.z)),max:new y(Math.max(e.x,t.x),Math.max(e.y,t.y),Math.max(e.z,t.z)),slow:n};return this.boxes.push(r),r}addCentered(e,t,n,r,i,a,o){return this.add({x:e-r/2,y:t-i/2,z:n-a/2},{x:e+r/2,y:t+i/2,z:n+a/2},o)}addObject(e,t=0){let n=new ye().setFromObject(e);return n.expandByScalar(t),this.add(n.min,n.max)}remove(e){let t=this.boxes.indexOf(e);t>=0&&this.boxes.splice(t,1)}rayXZ(e,t,n,r,i,a){let o=a;for(let a of this.boxes){if(a.enabled===!1||a.slow!==void 0||n<a.min.y||n>a.max.y)continue;let s=0,c=o;for(let[n,o,l,u]of[[e,r,a.min.x,a.max.x],[t,i,a.min.z,a.max.z]])if(Math.abs(o)<1e-9){if(n<l||n>u){s=1/0;break}}else{let e=(l-n)/o,t=(u-n)/o;e>t&&([e,t]=[t,e]),s=Math.max(s,e),c=Math.min(c,t)}s<=c&&s<o&&s>.05&&(o=s)}return o}clear(){this.boxes.length=0}groundBelow(e,t,n,r){let i=-1/0,a=1,o=0;for(let s of this.boxes)s.enabled!==!1&&(s.max.y>r||e+n*.5<s.min.x||e-n*.5>s.max.x||t+n*.5<s.min.z||t-n*.5>s.max.z||s.max.y>i&&(i=s.max.y,a=s.slow??1,o=s.depth??0));return{y:i,slow:a,depth:o}}ceilingAbove(e,t,n,r){let i=1/0;for(let a of this.boxes)a.enabled!==!1&&(a.min.y<r||e+n<a.min.x||e-n>a.max.x||t+n<a.min.z||t-n>a.max.z||(i=Math.min(i,a.min.y)));return i}pushOut(e,t,n,r){let i=!1;for(let a=0;a<3;a++){let a=!1;for(let o of this.boxes){if(o.enabled===!1||o.slow!==void 0||o.max.y<=n||o.min.y>=r)continue;let s=Math.max(o.min.x,Math.min(e.x,o.max.x)),c=Math.max(o.min.z,Math.min(e.z,o.max.z)),l=e.x-s,u=e.z-c,d=l*l+u*u;if(!(d>=t*t)){if(d<1e-10){let n=[[e.x-o.min.x,-1,0],[o.max.x-e.x,1,0],[e.z-o.min.z,0,-1],[o.max.z-e.z,0,1]];n.sort((e,t)=>e[0]-t[0]);let[r,i,a]=n[0];e.x+=i*(r+t),e.z+=a*(r+t)}else{let n=Math.sqrt(d);l/=n,u/=n,e.x=s+l*t,e.z=c+u*t}a=!0,i=!0}}if(!a)break}return i}},oi=class{keys=new Set;lookDX=0;lookDY=0;pressed=new Set;locked=!1;moveX=0;moveY=0;moveTouch=null;lookTouch=null;constructor(e){e.addEventListener(`touchstart`,e=>{for(let t of Array.from(e.changedTouches))t.clientX<window.innerWidth/2&&!this.moveTouch?this.moveTouch={id:t.identifier,x:t.clientX,y:t.clientY}:this.lookTouch||={id:t.identifier,x:t.clientX,y:t.clientY};e.preventDefault()},{passive:!1}),e.addEventListener(`touchmove`,e=>{for(let t of Array.from(e.changedTouches))this.moveTouch?.id===t.identifier?(this.moveX=Math.max(-1,Math.min(1,(t.clientX-this.moveTouch.x)/60)),this.moveY=Math.max(-1,Math.min(1,-(t.clientY-this.moveTouch.y)/60))):this.lookTouch?.id===t.identifier&&(this.lookDX+=(t.clientX-this.lookTouch.x)*1.6,this.lookDY+=(t.clientY-this.lookTouch.y)*1.6,this.lookTouch.x=t.clientX,this.lookTouch.y=t.clientY);e.preventDefault()},{passive:!1});let t=e=>{for(let t of Array.from(e.changedTouches))this.moveTouch?.id===t.identifier?(this.moveTouch=null,this.moveX=0,this.moveY=0):this.lookTouch?.id===t.identifier&&(this.lookTouch=null)};e.addEventListener(`touchend`,t),e.addEventListener(`touchcancel`,t),window.addEventListener(`keydown`,e=>{si(e)||(this.keys.has(e.code)||this.pressed.add(e.code),this.keys.add(e.code),(e.code===`Space`||e.code.startsWith(`Arrow`))&&e.preventDefault())}),window.addEventListener(`keyup`,e=>this.keys.delete(e.code)),window.addEventListener(`blur`,()=>this.keys.clear()),e.addEventListener(`click`,()=>{!this.locked&&!matchMedia(`(pointer: coarse)`).matches&&e.requestPointerLock?.()}),document.addEventListener(`pointerlockchange`,()=>{this.locked=document.pointerLockElement===e}),document.addEventListener(`mousemove`,e=>{this.locked&&(this.lookDX+=e.movementX,this.lookDY+=e.movementY)})}down(...e){return e.some(e=>this.keys.has(e))}hit(e){return this.pressed.has(e)}endFrame(){this.pressed.clear(),this.lookDX=0,this.lookDY=0}};function si(e){let t=e.target;return!!t&&(t.tagName===`INPUT`||t.tagName===`SELECT`||t.tagName===`TEXTAREA`)}var ci=1.72,li=1.12,ui=.12,di=.26,fi=.36,pi=18,mi=5.2,hi=class{camera;pos=new y;yaw=0;pitch=0;roll=0;vy=0;onGround=!1;fly=!1;height=ci;walkSpeed=1.55;runSpeed=3.6;sensitivity=.0022;bob=.6;bobPhase=0;bobAmp=0;vel=new y;spawn={pos:new y,yaw:0,pitch:0};constructor(e){this.camera=e}get eyeHeight(){return this.height-ui}setSpawn(e,t,n=0){this.spawn={pos:new y(e.x,e.y,e.z),yaw:t,pitch:n},this.respawn()}respawn(){this.pos.copy(this.spawn.pos),this.yaw=this.spawn.yaw,this.pitch=this.spawn.pitch,this.roll=0,this.vy=0,this.vel.set(0,0,0)}placeEye(t,n,r,i=0,a){if(this.height=ci,this.pos.set(t.x,t.y-this.eyeHeight,t.z),a){let n=a.groundBelow(t.x,t.z,di,t.y-.3);if(Number.isFinite(n.y)){let r=t.y-n.y+ui;this.height=e.clamp(r,.5,2.6),this.pos.y=n.y}}this.yaw=n,this.pitch=r,this.roll=i,this.vy=0,this.vel.set(0,0,0),this.bobAmp=0}externalCamera=!1;update(t,n,r){t=Math.min(t,.05),n.hit(`KeyF`)&&(this.fly=!this.fly),this.yaw-=n.lookDX*this.sensitivity,this.pitch-=n.lookDY*this.sensitivity,n.down(`KeyQ`)&&(this.yaw+=t*1.6),n.down(`KeyE`)&&(this.yaw-=t*1.6),this.pitch=e.clamp(this.pitch,-1.5,1.5),(n.lookDX!==0||n.lookDY!==0)&&(this.roll=0);let i=e.clamp(+!!n.down(`KeyW`,`ArrowUp`)-!!n.down(`KeyS`,`ArrowDown`)+n.moveY,-1,1),a=e.clamp(+!!n.down(`KeyD`,`ArrowRight`)-!!n.down(`KeyA`,`ArrowLeft`)+n.moveX,-1,1),o=n.down(`ShiftLeft`,`ShiftRight`),s=n.down(`KeyC`,`ControlLeft`,`ControlRight`),c=Math.sin(this.yaw),l=Math.cos(this.yaw),u=new y(-c*i+l*a,0,-l*i-c*a);if(u.lengthSq()>1&&u.normalize(),this.fly){let e=(o?8:3)*t,r=!!n.down(`Space`)-+!!s,u=Math.cos(this.pitch),d=new y(-c*u,Math.sin(this.pitch),-l*u);this.pos.addScaledVector(d,i*e),this.pos.x+=l*a*e,this.pos.z+=-c*a*e,this.pos.y+=r*e,this.vy=0,this.applyCamera(0);return}let d=r.ceilingAbove(this.pos.x,this.pos.z,di,this.pos.y+li-.05),f=s||d<this.pos.y+ci?li:ci;this.height+=(f-this.height)*Math.min(1,t*10);let p=r.groundBelow(this.pos.x,this.pos.z,di,this.pos.y+fi).slow,m=(s?this.walkSpeed*.55:o?this.runSpeed:this.walkSpeed)*p,h=this.onGround?14:3;this.vel.x+=(u.x*m-this.vel.x)*Math.min(1,h*t),this.vel.z+=(u.z*m-this.vel.z)*Math.min(1,h*t),this.onGround&&n.hit(`Space`)&&(this.vy=mi,this.onGround=!1);let g=Math.max(1,Math.ceil(Math.hypot(this.vel.x,this.vel.z)*t/.1));for(let e=0;e<g;e++)this.pos.x+=this.vel.x*t/g,this.pos.z+=this.vel.z*t/g,r.pushOut(this.pos,di,this.pos.y+fi,this.pos.y+this.height);this.vy-=pi*t;let _=this.pos.y+this.vy*t,v=r.groundBelow(this.pos.x,this.pos.z,di,this.pos.y+fi);_<=v.y?(_=this.onGround&&v.y>this.pos.y?Math.min(v.y,this.pos.y+t*4):v.y,v.y-_<.002&&(_=v.y),this.vy=0,this.onGround=!0):this.onGround=_-v.y<.02;let b=r.ceilingAbove(this.pos.x,this.pos.z,di,this.pos.y+this.height-.02);this.vy>0&&_+this.height>b&&(_=b-this.height,this.vy=0),this.pos.y=_,this.pos.y<-30&&this.respawn();let x=Math.hypot(this.vel.x,this.vel.z);this.bobAmp+=((this.onGround?Math.min(1,x/2):0)-this.bobAmp)*Math.min(1,t*6),this.bobPhase+=t*(5.2+x*1.4),this.applyCamera(this.externalCamera?0:this.bob*this.bobAmp)}applyCamera(e=0){let t=this.camera;if(t.position.set(this.pos.x,this.pos.y+this.eyeHeight,this.pos.z),e>0){t.position.y+=Math.sin(this.bobPhase*2)*.022*e;let n=Math.cos(this.bobPhase)*.018*e;t.position.x+=Math.cos(this.yaw)*n,t.position.z-=Math.sin(this.yaw)*n}t.rotation.set(this.pitch,this.yaw,this.roll,`YXZ`),t.updateMatrixWorld()}},gi=class{scale;target;matrix=new Pe;camera=new W;hide=[];enabled=!0;skipLayer=1;plane=new Se;normal;point;constructor(e,t={x:0,y:1,z:0},n=.5){this.scale=n,this.point=new y(e.x,e.y,e.z),this.normal=new y(t.x,t.y,t.z).normalize(),this.target=new r(16,16,{type:f,samples:0}),this.target.texture.colorSpace=ae,this.target.texture.generateMipmaps=!1}setSize(e,t){this.target.setSize(Math.max(1,Math.round(e*this.scale)),Math.max(1,Math.round(t*this.scale)))}render(e,t,n){if(!this.enabled)return;let r=new y().setFromMatrixPosition(n.matrixWorld),i=r.clone().sub(this.point);if(i.dot(this.normal)<=0)return;let a=this.point.clone().sub(i.reflect(this.normal).negate()),o=new y(0,0,-1).applyMatrix4(new Pe().extractRotation(n.matrixWorld)),s=r.clone().add(o),c=this.point.clone().sub(s);c.reflect(this.normal).negate(),c.add(this.point);let l=new y(0,1,0).applyMatrix4(new Pe().extractRotation(n.matrixWorld)).reflect(this.normal),u=this.camera;u.position.copy(a),u.up.copy(l),u.lookAt(c),u.far=n.far,u.near=n.near,u.fov=n.fov,u.aspect=n.aspect,u.updateMatrixWorld(),u.projectionMatrix.copy(n.projectionMatrix),u.layers.mask=n.layers.mask,u.layers.disable(this.skipLayer),u.layers.enable(2),this.matrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),this.matrix.multiply(u.projectionMatrix).multiply(u.matrixWorldInverse),this.plane.setFromNormalAndCoplanarPoint(this.normal,this.point).applyMatrix4(u.matrixWorldInverse);let d=new k(this.plane.normal.x,this.plane.normal.y,this.plane.normal.z,this.plane.constant),f=u.projectionMatrix,p=new k((Math.sign(d.x)+f.elements[8])/f.elements[0],(Math.sign(d.y)+f.elements[9])/f.elements[5],-1,(1+f.elements[10])/f.elements[14]);d.multiplyScalar(2/d.dot(p)),f.elements[2]=d.x,f.elements[6]=d.y,f.elements[10]=d.z+1-5e-4,f.elements[14]=d.w;let m=this.hide.map(e=>e.visible);this.hide.forEach(e=>e.visible=!1);let h=e.getRenderTarget(),g=e.shadowMap.autoUpdate;e.shadowMap.autoUpdate=!1,e.setRenderTarget(this.target),e.clear(),e.render(t,u),e.setRenderTarget(h),e.shadowMap.autoUpdate=g,this.hide.forEach((e,t)=>e.visible=m[t])}dispose(){this.target.dispose()}},_i=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},vi=new V(-1,1,1,-1,0,1),yi=new class extends fe{constructor(){super(),this.setAttribute(`position`,new v([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new v([0,2,0,0,2,0],2))}},bi=class{constructor(e){this._mesh=new U(yi,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,vi)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},xi=`
float sl_hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 sl_hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float sl_hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// 値ノイズ（-1..1）
float sl_vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = sl_hash13(i);
  float n100 = sl_hash13(i + vec3(1, 0, 0));
  float n010 = sl_hash13(i + vec3(0, 1, 0));
  float n110 = sl_hash13(i + vec3(1, 1, 0));
  float n001 = sl_hash13(i + vec3(0, 0, 1));
  float n101 = sl_hash13(i + vec3(1, 0, 1));
  float n011 = sl_hash13(i + vec3(0, 1, 1));
  float n111 = sl_hash13(i + vec3(1, 1, 1));
  float a = mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y);
  float b = mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y);
  return mix(a, b, u.z) * 2.0 - 1.0;
}
float sl_fbm(vec3 p, int oct) {
  float s = 0.0;
  float a = 0.5;
  float n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * sl_vnoise(p);
    n += a;
    p = p * 2.03 + vec3(17.1, 9.2, 3.7);
    a *= 0.5;
  }
  return s / n;
}
// ねじったノイズ（ちぎった紙のような縁になる）
float sl_warp(vec3 p, int oct) {
  vec3 q = vec3(sl_fbm(p, 3), sl_fbm(p + vec3(5.2, 1.3, 2.8), 3), sl_fbm(p + vec3(1.7, 9.2, 4.1), 3));
  return sl_fbm(p + q * 1.6, oct);
}
// 升目ノイズ（細胞の中心までの距離）
vec2 sl_voronoi(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(x, y, z);
    vec3 o = sl_hash33(i + g);
    vec3 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
`,Si=`
vec3 sl_linToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0); m = pow(max(m, 0.0), 1.0 / 3.0); s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827607001 * m - 0.8086757660 * s);
}
vec3 sl_oklabToLin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
float sl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// 画素 1 つ分だけぼかした段の境目
float sl_aastep(float t, float v, float soft) {
  float w = max(fwidth(v) * 0.75, soft);
  return smoothstep(t - w, t + w, v);
}
`,Ci=`
vec2 sl_planarUV(vec3 wp, vec3 wn) {
  vec3 a = abs(wn);
  if (a.y >= a.x && a.y >= a.z) return wp.xz;
  if (a.x >= a.z) return vec2(wp.z, wp.y);
  return vec2(wp.x, wp.y);
}
`,wi=`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;function Ti(e,t,n={}){return new bi(new me({vertexShader:wi,fragmentShader:e,uniforms:t,defines:n,depthTest:!1,depthWrite:!1}))}function Ei(e,t,n={}){let i=new r(e,t,{type:f,depthBuffer:!1,...n});return i.texture.colorSpace=ae,i.texture.generateMipmaps=!1,i}var Di=class{prefilterUniforms;count;levels=[];ups=[];prefilter;down;up;constructor(e,t,n=6){this.prefilterUniforms=t,this.count=n,this.prefilter=Ti(e,{tSrc:{value:null},...t}),this.down=Ti(`
      uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
        c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
        gl_FragColor = vec4(c / 8.0, 1.0);
      }`,{tSrc:{value:null},uTexel:{value:new m}}),this.up=Ti(`
      uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
      void main() {
        vec2 o = uTexel * uRadius;
        vec3 c = texture2D(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0;
        c += texture2D(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.0;
        c += texture2D(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0;
        c += texture2D(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
        gl_FragColor = vec4(c / 12.0 + texture2D(tBase, vUv).rgb, 1.0);
      }`,{tSrc:{value:null},tBase:{value:null},uTexel:{value:new m},uRadius:{value:1}})}setSize(e,t){this.dispose();let n=Math.max(1,e>>1),r=Math.max(1,t>>1);for(let e=0;e<this.count;e++)this.levels.push(Ei(n,r)),this.ups.push(Ei(n,r)),n=Math.max(1,n>>1),r=Math.max(1,r>>1)}render(e,t,n){let r=this.prefilter.material;r.uniforms.tSrc.value=t,e.setRenderTarget(this.levels[0]),this.prefilter.render(e);let i=this.down.material;for(let t=1;t<this.levels.length;t++){let n=this.levels[t-1];i.uniforms.tSrc.value=n.texture,i.uniforms.uTexel.value.set(1/n.width,1/n.height),e.setRenderTarget(this.levels[t]),this.down.render(e)}let a=this.up.material,o=this.levels[this.levels.length-1].texture;for(let t=this.levels.length-2;t>=0;t--){let r=this.levels[t+1];a.uniforms.tSrc.value=o,a.uniforms.tBase.value=this.levels[t].texture,a.uniforms.uTexel.value.set(1/r.width,1/r.height),a.uniforms.uRadius.value=n,e.setRenderTarget(this.ups[t]),this.up.render(e),o=this.ups[t].texture}return o}dispose(){for(let e of[...this.levels,...this.ups])e.dispose();this.levels.length=0,this.ups.length=0}},Oi=`
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
vec3 s(vec2 o) { return clamp(texture2D(tSrc, vUv + o * uTexel).rgb, 0.0, 1.0); }
void main() {
  vec3 sx = (s(vec2(-1,-1)) + 2.0*s(vec2(-1,0)) + s(vec2(-1,1)) - s(vec2(1,-1)) - 2.0*s(vec2(1,0)) - s(vec2(1,1))) / 4.0;
  vec3 sy = (s(vec2(-1,-1)) + 2.0*s(vec2(0,-1)) + s(vec2(1,-1)) - s(vec2(-1,1)) - 2.0*s(vec2(0,1)) - s(vec2(1,1))) / 4.0;
  gl_FragColor = vec4(dot(sx, sx), dot(sy, sy), dot(sx, sy), 1.0);
}`,ki=`
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tSrc, vUv) * 0.2270270270;
  c += texture2D(tSrc, vUv + uDir * 1.3846153846) * 0.3162162162;
  c += texture2D(tSrc, vUv - uDir * 1.3846153846) * 0.3162162162;
  c += texture2D(tSrc, vUv + uDir * 3.2307692308) * 0.0702702703;
  c += texture2D(tSrc, vUv - uDir * 3.2307692308) * 0.0702702703;
  gl_FragColor = c;
}`,Ai=`
uniform sampler2D tSrc; uniform sampler2D tTensor; uniform vec2 uTexel;
uniform float uRadius; uniform float uSharpness; uniform float uAlpha; uniform float uHardness;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tTensor, vUv);
  float d = sqrt(max(t.y * t.y - 2.0 * t.x * t.y + t.x * t.x + 4.0 * t.z * t.z, 0.0));
  float l1 = 0.5 * (t.y + t.x + d);
  float l2 = 0.5 * (t.y + t.x - d);
  vec2 v = vec2(l1 - t.x, -t.z);
  vec2 dir = length(v) > 0.0 ? normalize(v) : vec2(0.0, 1.0);
  float phi = -atan(dir.y, dir.x);
  float A = (l1 + l2 > 0.0) ? (l1 - l2) / (l1 + l2) : 0.0;
  float r = uRadius;
  float a = r * clamp((uAlpha + A) / uAlpha, 0.1, 2.0);
  float b = r * clamp(uAlpha / (uAlpha + A), 0.1, 2.0);
  float cp = cos(phi), sp = sin(phi);
  mat2 R = mat2(cp, -sp, sp, cp);
  mat2 S = mat2(0.5 / a, 0.0, 0.0, 0.5 / b);
  mat2 SR = S * R;
  int mx = int(sqrt(a * a * cp * cp + b * b * sp * sp));
  int my = int(sqrt(a * a * sp * sp + b * b * cp * cp));
  float zeta = 2.0 / max(r, 1.0);
  float zc = 0.58;
  float sz = sin(zc);
  float eta = (zeta + cos(zc)) / (sz * sz);
  vec4 m[8]; vec3 s[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  mx = min(mx, 12);
  my = min(my, 12);
  for (int y = -my; y <= my; y++) {
    for (int x = -mx; x <= mx; x++) {
      vec2 vv = SR * vec2(float(x), float(y));
      if (dot(vv, vv) > 0.25) continue;
      vec3 c = clamp(texture2D(tSrc, vUv + vec2(float(x), float(y)) * uTexel).rgb, 0.0, 1.0);
      float w[8]; float sum = 0.0; float z; float vxx; float vyy;
      vxx = zeta - eta * vv.x * vv.x; vyy = zeta - eta * vv.y * vv.y;
      z = max(0.0, vv.y + vxx); w[0] = z * z; sum += w[0];
      z = max(0.0, -vv.x + vyy); w[2] = z * z; sum += w[2];
      z = max(0.0, -vv.y + vxx); w[4] = z * z; sum += w[4];
      z = max(0.0, vv.x + vyy); w[6] = z * z; sum += w[6];
      vec2 v2 = 0.70710678 * vec2(vv.x - vv.y, vv.x + vv.y);
      vxx = zeta - eta * v2.x * v2.x; vyy = zeta - eta * v2.y * v2.y;
      z = max(0.0, v2.y + vxx); w[1] = z * z; sum += w[1];
      z = max(0.0, -v2.x + vyy); w[3] = z * z; sum += w[3];
      z = max(0.0, -v2.y + vxx); w[5] = z * z; sum += w[5];
      z = max(0.0, v2.x + vyy); w[7] = z * z; sum += w[7];
      float g = exp(-3.125 * dot(vv, vv)) / max(sum, 1e-6);
      for (int k = 0; k < 8; k++) {
        float wk = w[k] * g;
        m[k] += vec4(c * wk, wk);
        s[k] += c * c * wk;
      }
    }
  }
  vec4 o = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    if (m[k].w <= 0.0) continue;
    vec3 mu = m[k].rgb / m[k].w;
    vec3 sg = abs(s[k] / m[k].w - mu * mu);
    float s2 = sg.r + sg.g + sg.b;
    float w = 1.0 / (1.0 + pow(uHardness * 1000.0 * s2, 0.5 * uSharpness));
    o += vec4(mu * w, w);
  }
  vec3 src = texture2D(tSrc, vUv).rgb;
  vec3 res = o.w > 0.0 ? o.rgb / o.w : src;
  // HDR（光る板）はそのまま残す
  float hdr = max(max(src.r, src.g), src.b);
  gl_FragColor = vec4(hdr > 1.0 ? src : res, 1.0);
}`,ji=`
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tInfo;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform float uTime;
uniform float uDebug;
// 線
uniform vec4 uLine;       // enabled, width, depth, normal
uniform vec4 uLine2;      // id, breakup, fadeFar, opacity
uniform vec3 uLineColor;
// ブルーム・ディフュージョン
uniform float uBloom;
uniform float uDiffusion;
// 画面のグラデーション
uniform vec4 uGradA[3];   // p0.xy, p1.xy
uniform vec4 uGradB[3];   // color.rgb, amount
uniform float uGradMode[3];
// 色調整
uniform vec4 uGrade1;     // exposure, lift, gamma, gain
uniform vec4 uGrade2;     // saturation, hue(rad), tint.a, tint.b
uniform vec4 uGrade3;     // posterize, sharpness, vignette, grain
uniform vec4 uHaze;       // color.rgb, amount
uniform float uToneMap;
uniform float uLinearOut;
uniform float uFilmScale;
varying vec2 vUv;
${xi}
${Si}

float linDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, uNear, uFar);
}
vec3 viewPos(vec2 uv, float d) {
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
vec3 decodeN(vec4 info) {
  vec2 xy = info.xy * 2.0 - 1.0;
  return vec3(xy, sqrt(max(1.0 - dot(xy, xy), 0.0)));
}
// AgX（three の実装と同じ係数の簡略版）
vec3 agx(vec3 color) {
  const mat3 AgXInsetMatrix = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 AgXOutsetMatrix = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float AgxMinEv = -12.47393;
  const float AgxMaxEv = 4.026069;
  color = AgXInsetMatrix * max(color, 1e-10);
  color = clamp(log2(color), AgxMinEv, AgxMaxEv);
  color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
  vec3 x2 = color * color; vec3 x4 = x2 * x2;
  color = + 15.5 * x4 * x2 - 40.14 * x4 * color + 31.96 * x4 - 6.868 * x2 * color + 0.4298 * x2 + 0.1191 * color - 0.00232;
  color = AgXOutsetMatrix * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  return clamp(color, 0.0, 1.0);
}
vec3 neutral(vec3 color) {
  const float StartCompression = 0.8 - 0.04;
  const float Desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < StartCompression) return color;
  float d = 1. - StartCompression;
  float newPeak = 1. - d * d / (peak + d - StartCompression);
  color *= newPeak / peak;
  float g = 1. - 1. / (Desaturation * (peak - newPeak) + 1.);
  return mix(color, vec3(newPeak), g);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  vec4 info = texture2D(tInfo, vUv);
  float rawD = texture2D(tDepth, vUv).x;
  float dC = -perspectiveDepthToViewZ(rawD, uNear, uFar);

  // ---- 線 ----
  float edge = 0.0;
  if (uLine.x > 0.5) {
    vec2 px = uLine.y / uRes;
    vec3 nC = decodeN(info);
    vec3 vp = viewPos(vUv, rawD);
    float ndv = abs(dot(nC, normalize(-vp)));
    float graze = 1.0 + clamp((1.0 - ndv - 0.5) / 0.5, 0.0, 1.0) * 7.0;
    float dTh = uLine.z * graze;
    float wMax = info.w;
    float dE = 0.0; float nE = 0.0; float iE = 0.0;
    // 深度は中心と周り 8 つ（深度は MSAA で平均されない）。
    // 法線と ID は向かい合う 2 つの組で比べる（縁の画素は MSAA で法線が平均されるので、中心と比べると線が点線になる）
    for (int i = 0; i < 4; i++) {
      vec2 o = i == 0 ? vec2(1,0) : i == 1 ? vec2(0,1) : i == 2 ? vec2(1,1) : vec2(1,-1);
      vec2 uvA = vUv + o * px;
      vec2 uvB = vUv - o * px;
      vec4 iA = texture2D(tInfo, uvA);
      vec4 iB = texture2D(tInfo, uvB);
      float dA = linDepth(uvA);
      float dB = linDepth(uvB);
      // 手前の物の線の重みを使う（線は奥側に描く）
      if (dA < dC) wMax = max(wMax, iA.w);
      if (dB < dC) wMax = max(wMax, iB.w);
      dE = max(dE, max((dC - dA) / max(dA, 1e-3), (dC - dB) / max(dB, 1e-3)));
      nE = max(nE, 1.0 - dot(decodeN(iA), decodeN(iB)));
      iE = max(iE, step(0.002, abs(iA.z - iB.z)) * step(0.001, iA.w * iB.w));
    }
    float e = max(step(dTh, dE), smoothstep(uLine.w * 0.85, uLine.w * 1.15, nE));
    e = max(e, iE * uLine2.x);
    // 遠くで消す・ワールド座標のノイズで途切れさせる
    float fade = 1.0 - smoothstep(uLine2.z * 0.6, uLine2.z, dC);
    vec3 wp = (uCamWorld * vec4(vp, 1.0)).xyz;
    float nz = sl_fbm(wp * 2.2, 3) * 0.5 + 0.5;
    float keep = smoothstep(uLine2.y - 0.08, uLine2.y + 0.08, nz + 0.0001) ;
    keep = uLine2.y <= 0.0 ? 1.0 : keep;
    edge = e * wMax * fade * keep * uLine2.w;
    col = mix(col, uLineColor, clamp(edge, 0.0, 1.0));
  }

  // ---- ブルーム・ディフュージョン ----
  col += texture2D(tBloom, vUv).rgb * uBloom;
  if (uDiffusion > 0.0) {
    vec3 dfz = texture2D(tDiffuse, vUv).rgb;
    vec3 sc = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - clamp(dfz, 0.0, 1.0));
    col = mix(col, max(sc, col), uDiffusion);
  }

  // ---- 露出・トーン ----
  col *= uGrade1.x;
  if (uToneMap > 1.5) col = neutral(col);
  else if (uToneMap > 0.5) col = agx(col);

  // ---- 画面のグラデーション（パラ・フレア） ----
  for (int i = 0; i < 3; i++) {
    if (uGradB[i].w <= 0.0) continue;
    vec2 a = uGradA[i].xy; vec2 b = uGradA[i].zw;
    vec2 ab = b - a;
    float t = clamp(dot(vUv - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float k = (1.0 - t) * uGradB[i].w;
    vec3 gc = uGradB[i].rgb;
    if (uGradMode[i] < 0.5) col = mix(col, col * gc, k);
    else if (uGradMode[i] < 1.5) col += gc * k;
    else col = mix(col, 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - gc), k);
  }

  // ---- 色調整（OKLab） ----
  vec3 lab = sl_linToOklab(max(col, 0.0));
  float L = lab.x * uGrade1.w;
  L = L + uGrade1.y * (1.0 - L);
  L = pow(max(L, 0.0), 1.0 / max(uGrade1.z, 1e-3));
  if (uGrade3.x > 0.0) {
    float n = uGrade3.x;
    float q = floor(L * n + 0.5) / n;
    L = q + (0.5 / n) * tanh(uGrade3.y * (L - q) * n);
  }
  float C = length(lab.yz) * uGrade2.x;
  float h = atan(lab.z, lab.y) + uGrade2.y;
  lab = vec3(L, cos(h) * C + uGrade2.z, sin(h) * C + uGrade2.w);
  col = sl_oklabToLin(lab);
  col = mix(col, uHaze.rgb, uHaze.w);

  // ---- 周辺減光・粒 ----
  vec2 cv = vUv - 0.5;
  col *= 1.0 - uGrade3.z * smoothstep(0.35, 0.95, length(cv * vec2(1.0, uRes.y / uRes.x) * 1.6));
  if (uLinearOut > 0.5) {
    // カメラ効果（Film）へ線形のまま渡す（sRGB・粒はその後）
    gl_FragColor = vec4(max(col, 0.0) * uFilmScale, 1.0);
    return;
  }
  vec3 outc = toSRGB(col);
  float gn = sl_hash12(vUv * uRes + fract(uTime) * 917.0) - 0.5;
  outc += gn * uGrade3.w;
  outc += (sl_hash12(vUv * uRes * 1.37) - 0.5) / 255.0;

  if (uDebug > 0.5) {
    if (uDebug < 1.5) outc = toSRGB(texture2D(tColor, vUv).rgb);
    else if (uDebug < 2.5) outc = info.xyz * vec3(1.0, 1.0, 0.0) + vec3(0.0, 0.0, 0.5);
    else if (uDebug < 3.5) outc = vec3(info.z, fract(info.z * 7.0), info.w);
    else if (uDebug < 4.5) outc = vec3(1.0 - clamp(dC / 60.0, 0.0, 1.0));
    else outc = vec3(1.0 - clamp(edge, 0.0, 1.0));
  }
  gl_FragColor = vec4(outc, 1.0);
}`,Mi=class{renderer;sceneRT;kuwaharaRT;tensorRT;tensorRT2;tensor;gauss;akf;bloom;diffusion;composite;reflectors=[];style;debug=0;enable={kuwahara:!0,lines:!0,bloom:!0,grade:!0};width=1;height=1;constructor(e){this.renderer=e,this.sceneRT=new r(1,1,{count:2,type:f,samples:4,depthBuffer:!0,depthTexture:new t(1,1,b)});for(let e of this.sceneRT.textures)e.colorSpace=ae,e.generateMipmaps=!1,e.minFilter=h,e.magFilter=h;this.sceneRT.textures[1].minFilter=B,this.sceneRT.textures[1].magFilter=B,this.kuwaharaRT=Ei(1,1),this.tensorRT=Ei(1,1),this.tensorRT2=Ei(1,1),this.tensor=Ti(Oi,{tSrc:{value:null},uTexel:{value:new m}}),this.gauss=Ti(ki,{tSrc:{value:null},uDir:{value:new m}}),this.akf=Ti(Ai,{tSrc:{value:null},tTensor:{value:null},uTexel:{value:new m},uRadius:{value:5},uSharpness:{value:8},uAlpha:{value:1},uHardness:{value:8}}),this.bloom=new Di(`
      uniform sampler2D tSrc; uniform float uThreshold; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb;
        float l = max(max(c.r, c.g), c.b);
        float k = clamp((l - uThreshold) / max(l, 1e-4), 0.0, 1.0);
        gl_FragColor = vec4(c * k, 1.0);
      }`,{uThreshold:{value:1}}),this.diffusion=new Di(`
      uniform sampler2D tSrc; uniform float uThreshold; varying vec2 vUv;
      void main() {
        vec3 c = clamp(texture2D(tSrc, vUv).rgb, 0.0, 4.0);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor = vec4(c * smoothstep(uThreshold - 0.2, uThreshold + 0.2, l), 1.0);
      }`,{uThreshold:{value:.6}},5),this.composite=Ti(ji,{tColor:{value:null},tInfo:{value:null},tDepth:{value:null},tBloom:{value:null},tDiffuse:{value:null},uRes:{value:new m},uNear:{value:.05},uFar:{value:1e3},uProjInv:{value:new Pe},uCamWorld:{value:new Pe},uTime:z.uTime,uDebug:{value:0},uLine:{value:new k},uLine2:{value:new k},uLineColor:{value:new q},uBloom:{value:0},uDiffusion:{value:0},uGradA:{value:[new k,new k,new k]},uGradB:{value:[new k,new k,new k]},uGradMode:{value:[0,0,0]},uGrade1:{value:new k(1,0,1,1)},uGrade2:{value:new k(1,0,0,0)},uGrade3:{value:new k(0,12,0,0)},uHaze:{value:new k},uToneMap:{value:0},uLinearOut:{value:0},uFilmScale:{value:1}})}film=null;setFilm(e){this.film=e,e?.setSize(this.width,this.height),e?.setDepthTexture(this.sceneRT.depthTexture)}setSize(e,t){this.width=e,this.height=t,this.sceneRT.setSize(e,t),this.bloom.setSize(e,t),this.diffusion.setSize(e,t);for(let n of this.reflectors)n.setSize(e,t);this.film?.setSize(e,t)}render(t,n){let r=this.renderer,i=this.style,a=i.post;for(let e of this.reflectors)e.render(r,t,n);r.setRenderTarget(this.sceneRT),r.setClearColor(i.background,1),r.clear(),r.render(t,n);let o=this.sceneRT.textures[0],s=i.post.kuwahara;if(s.enabled&&this.enable.kuwahara&&this.debug===0){let t=new m(1/this.width,1/this.height),n=e.clamp(s.scale??1,.25,1),i=Math.max(1,Math.round(this.width*n)),a=Math.max(1,Math.round(this.height*n));(this.kuwaharaRT.width!==i||this.kuwaharaRT.height!==a)&&(this.kuwaharaRT.setSize(i,a),this.tensorRT.setSize(i,a),this.tensorRT2.setSize(i,a));let c=new m(1/i,1/a),l=this.tensor.material;l.uniforms.tSrc.value=o,l.uniforms.uTexel.value.copy(t),r.setRenderTarget(this.tensorRT),this.tensor.render(r);let u=this.gauss.material;u.uniforms.tSrc.value=this.tensorRT.texture,u.uniforms.uDir.value.set(c.x,0),r.setRenderTarget(this.tensorRT2),this.gauss.render(r),u.uniforms.tSrc.value=this.tensorRT2.texture,u.uniforms.uDir.value.set(0,c.y),r.setRenderTarget(this.tensorRT),this.gauss.render(r);let d=this.akf.material;d.uniforms.tSrc.value=o,d.uniforms.tTensor.value=this.tensorRT.texture,d.uniforms.uRadius.value=Math.min(s.radius*n,12),d.uniforms.uTexel.value.copy(t).divideScalar(n),d.uniforms.uSharpness.value=s.sharpness,d.uniforms.uAlpha.value=s.aniso,r.setRenderTarget(this.kuwaharaRT),this.akf.render(r),o=this.kuwaharaRT.texture}let c=i.post.bloom,l=null;c.strength>0&&this.enable.bloom&&(this.bloom.prefilterUniforms.uThreshold.value=c.threshold,l=this.bloom.render(r,o,c.radius*1.5+.5));let u=null;a.diffusion.amount>0&&this.enable.bloom&&(this.diffusion.prefilterUniforms.uThreshold.value=a.diffusion.threshold,u=this.diffusion.render(r,o,a.diffusion.radius*1.5+.5));let d=this.composite.material.uniforms;d.tColor.value=o,d.tInfo.value=this.sceneRT.textures[1],d.tDepth.value=this.sceneRT.depthTexture,d.tBloom.value=l??this.sceneRT.textures[0],d.tDiffuse.value=u??this.sceneRT.textures[0],d.uBloom.value=l?c.strength:0,d.uDiffusion.value=u?a.diffusion.amount:0,d.uRes.value.set(this.width,this.height),d.uNear.value=n.near,d.uFar.value=n.far,d.uProjInv.value.copy(n.projectionMatrixInverse),d.uCamWorld.value.copy(n.matrixWorld),d.uDebug.value=this.debug;let f=i.post.lines,p=f.enabled&&this.enable.lines;d.uLine.value.set(+!!p,f.width*(this.height/816),f.depth,f.normal),d.uLine2.value.set(f.id,f.breakup,f.fadeFar,f.opacity),d.uLineColor.value.set(f.color);let h=i.post.grade,g=this.enable.grade;if(d.uGrade1.value.set(h.exposure,g?h.lift:0,g?h.gamma:1,g?h.gain:1),d.uGrade2.value.set(g?h.saturation:1,g?h.hue*Math.PI/180:0,g?h.tint[0]:0,g?h.tint[1]:0),d.uGrade3.value.set(g?h.posterize:0,a.posterizeSharpness,g?h.vignette:0,g?h.grain:0),h.haze&&g){let e=new q(h.haze.color);d.uHaze.value.set(e.r,e.g,e.b,h.haze.amount)}else d.uHaze.value.set(0,0,0,0);d.uToneMap.value=a.toneMap===`agx`?1:a.toneMap===`neutral`?2:0;for(let e=0;e<3;e++){let t=g?a.gradients[e]:void 0;if(!t){d.uGradB.value[e].set(0,0,0,0);continue}let n=new q(t.color);d.uGradA.value[e].set(t.p0[0],t.p0[1],t.p1[0],t.p1[1]),d.uGradB.value[e].set(n.r,n.g,n.b,t.amount),d.uGradMode.value[e]=t.blend===`mul`?0:t.blend===`add`?1:2}let _=this.film&&this.film.active&&this.debug===0?this.film:null;d.uLinearOut.value=+!!_,d.uFilmScale.value=_?_.inputScale:1,r.setRenderTarget(_?_.linearTarget:null),this.composite.render(r),_?.render(r)}dispose(){this.sceneRT.dispose(),this.kuwaharaRT.dispose(),this.tensorRT.dispose(),this.tensorRT2.dispose(),this.bloom.dispose(),this.diffusion.dispose()}},Ni=`
uniform float uLampCount;
uniform vec4 uLampPos[16];
uniform vec4 uLampColor[16];
uniform vec3 uLampBoxMin[16];
uniform vec3 uLampBoxMax[16];
uniform vec4 uLampExtra[16]; // 影の効き, yaw, 四角, 硬い
uniform vec2 uLampParams;
uniform float uLampQuant;
uniform vec3 uLampAllMin;
uniform vec3 uLampAllMax;
// 灯りの明るさ（照明の倍率に足す。RGB）。sunVis = この画素の平行光源の影（1 = 日なた）
vec3 sl_lamps(vec3 p, vec3 n, float sunVis) {
  vec3 acc = vec3(0.0);
  // どの灯りの箱にも入らない画素は繰り返しをしない（全部の箱を包む箱で先に調べる）
  if (any(lessThan(p, uLampAllMin)) || any(greaterThan(p, uLampAllMax))) return acc;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uLampCount) break;
    vec3 q = p;
    float yw = uLampExtra[i].y;
    if (yw != 0.0) {
      // 回した箱: 点を箱の向きへ戻してから調べる
      vec3 bc = (uLampBoxMin[i] + uLampBoxMax[i]) * 0.5;
      vec3 r = p - bc;
      float cs = cos(yw);
      float sn = sin(yw);
      q = bc + vec3(cs * r.x - sn * r.z, r.y, sn * r.x + cs * r.z);
    }
    if (any(lessThan(q, uLampBoxMin[i])) || any(greaterThan(q, uLampBoxMax[i]))) continue;
    // 硬い縁: 面の上の点を影の升目の中心へ寄せる（縁が升目に沿って段になる）
    vec3 pp = p;
    if (uLampExtra[i].w > 0.5 && uLampQuant > 0.0) {
      vec3 an = abs(n);
      vec3 cell = (floor(p / uLampQuant) + 0.5) * uLampQuant;
      if (an.y >= an.x && an.y >= an.z) pp.xz = cell.xz; else if (an.x >= an.z) pp.zy = cell.zy; else pp.xy = cell.xy;
    }
    vec3 d = uLampPos[i].xyz - pp;
    float dist = length(d);
    float r = uLampPos[i].w;
    float x;
    if (uLampExtra[i].z > 0.5) {
      // 四角: 箱の向きで、横は大きい方の軸・縦は半分の重み
      vec3 e = -d;
      if (yw != 0.0) {
        float c2 = cos(yw);
        float s2 = sin(yw);
        e = vec3(c2 * e.x - s2 * e.z, e.y, s2 * e.x + c2 * e.z);
      }
      vec3 a = abs(e) / r;
      x = max(max(a.x, a.z), a.y * 0.5);
    } else {
      x = dist / r;
    }
    if (x >= 1.0) continue;
    vec3 l = d / max(dist, 1e-4);
    // なめらかに 0 へ（中心付近は平ら、縁で落ちる。塗りの光だまりの形）。硬い縁は途中で切る
    float att = 1.0 - x * x;
    att *= att;
    if (uLampExtra[i].w > 0.5) att = step(0.3, att);
    // 面の向き（回り込みを少し入れて、壁も淡く照らす）
    float ndl = max(dot(n, l), 0.0) * 0.7 + 0.3;
    // 下向きの灯り: 真下ほど明るい
    float cone = uLampColor[i].w > 0.5 ? smoothstep(0.15, 0.85, l.y) : 1.0;
    acc += uLampColor[i].rgb * att * ndl * cone * mix(1.0, sunVis, uLampExtra[i].x);
  }
  return acc;
}
`,Pi=new q,Fi=class{list=[];maxDist=24;order=[];add(e){return this.list.push(e),e}clear(){this.list.length=0}update(e){let t=z;this.order.length=0;for(let t of this.list){if(t.on===!1||t.intensity<=0)continue;let n=t.box??[t.pos[0]-t.radius,t.pos[1]-t.radius,t.pos[2]-t.radius,t.pos[0]+t.radius,t.pos[1]+t.radius,t.pos[2]+t.radius],r=Math.max(n[0]-e.x,0,e.x-n[3]),i=Math.max(n[1]-e.y,0,e.y-n[4]),a=Math.max(n[2]-e.z,0,e.z-n[5]);Math.hypot(r,i,a)>this.maxDist||this.order.push({l:t,d:Math.hypot(r,i,a)*4+Math.hypot(t.pos[0]-e.x,t.pos[1]-e.y,t.pos[2]-e.z)*.1})}this.order.sort((e,t)=>e.d-t.d);let n=Math.min(16,this.order.length),r=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let e=0;e<n;e++){let n=this.order[e].l,i=n.box??[n.pos[0]-n.radius,n.pos[1]-n.radius,n.pos[2]-n.radius,n.pos[0]+n.radius,n.pos[1]+n.radius,n.pos[2]+n.radius];t.uLampPos.value[e].set(n.pos[0],n.pos[1],n.pos[2],n.radius),Pi.set(n.color??16777215),t.uLampColor.value[e].set(Pi.r*n.intensity,Pi.g*n.intensity,Pi.b*n.intensity,+!!n.down),t.uLampBoxMin.value[e].set(i[0],i[1],i[2]),t.uLampBoxMax.value[e].set(i[3],i[4],i[5]),t.uLampExtra.value[e].set(n.shadow??.8,n.yaw??0,+!!n.square,+!!n.hard);let a=(i[0]+i[3])/2,o=(i[2]+i[5])/2,s=Math.abs(Math.cos(n.yaw??0)),c=Math.abs(Math.sin(n.yaw??0)),l=(i[3]-i[0])/2*s+(i[5]-i[2])/2*c,u=(i[3]-i[0])/2*c+(i[5]-i[2])/2*s;r[0]=Math.min(r[0],a-l),r[1]=Math.min(r[1],i[1]),r[2]=Math.min(r[2],o-u),r[3]=Math.max(r[3],a+l),r[4]=Math.max(r[4],i[4]),r[5]=Math.max(r[5],o+u)}t.uLampAllMin.value.set(r[0],r[1],r[2]),t.uLampAllMax.value.set(r[3],r[4],r[5]),t.uLampCount.value=n}},Ii=0;function Li(e,t){let n=new Ee({color:t.color,map:t.map??null,roughness:t.roughness??1,metalness:t.metalness??0,emissive:t.emissive??0,emissiveIntensity:t.emissiveIntensity??1,transparent:t.transparent??!1,opacity:t.opacity??1,side:t.side??0,vertexColors:t.vertexColors??!1,depthWrite:t.depthWrite??!0,alphaTest:t.alphaTest??0}),r=new q(t.color),i=t.shade===void 0?ge(t.color,e.toon.shade):new q(t.shade),a=t.dark===void 0?ge(t.color,e.toon.dark):new q(t.dark),o=t.hi===void 0?ge(t.color,e.toon.hi):new q(t.hi),s=e=>new y(e.r/Math.max(r.r,1e-4),e.g/Math.max(r.g,1e-4),e.b/Math.max(r.b,1e-4)),c={};!t.unlit&&(t.toon??1)>0&&(c.SL_TOON=1),t.unlit&&(c.SL_UNLIT=1),t.noFog&&(c.SL_NOFOG=1),t.tiles&&(c.SL_TILES=1),t.flecks&&(c.SL_FLECKS=1),t.flecks?.color2!==void 0&&(c.SL_FLECKS2=1),t.blotch&&(c.SL_BLOTCH=1),t.puddle&&(c.SL_PUDDLE=1),t.reflection&&(c.SL_REFLECT=1),t.reflection?.puddleOnly&&(c.SL_REFLECT_PUDDLE=1),t.underwater&&(c.SL_UNDERWATER=1),n.defines={...n.defines??{},...c};let l=t.tiles?Array.isArray(t.tiles.size)?t.tiles.size:[t.tiles.size,t.tiles.size]:[1,1],u={uSlRatioShade:{value:s(i)},uSlRatioDark:{value:s(a)},uSlRatioHi:{value:s(o)},uSlToon:{value:t.toon??1},uSlNoiseMul:{value:new m(...t.noise??[1,1])},uSlSpecKill:{value:t.specKill??1},uSlBounce:{value:t.bounce??-1},uSlQuant:{value:t.shadowQuant===!1?0:1},uSlLine:{value:t.line??1},uSlId:{value:Ii++*.618034%1*.9+.05},uSlTile:{value:new k(l[0],l[1],t.tiles?.line??.01,t.tiles?.jitter??0)},uSlTileOffset:{value:new y(t.tiles?.offset?.[0]??0,t.tiles?.offset?.[1]??0,t.tiles?.broken??0)},uSlTileColor:{value:new q(t.tiles?.color??0)},uSlFleck:{value:new k(t.flecks?.scale??1,t.flecks?.density??0,t.flecks?.length??.3,t.flecks?.width??.05)},uSlFleckColor:{value:new q(t.flecks?.color??16777215)},uSlFleckColor2:{value:new q(t.flecks?.color2??0)},uSlFleckDensity2:{value:t.flecks?.density2??0},uSlBlotch:{value:new k(t.blotch?.scale??1,t.blotch?.threshold??1,t.blotch?.yGain??0,0)},uSlBlotchY:{value:new m(...t.blotch?.yRange??[0,0])},uSlBlotchO:{value:new y(...t.blotch?.grad?.origin??[0,0,0])},uSlBlotchLin:{value:new y(...t.blotch?.grad?.linear??[0,0,0])},uSlBlotchAbs:{value:new y(...t.blotch?.grad?.abs??[0,0,0])},uSlBlotchColor:{value:new q(t.blotch?.color??16777215)},uSlBlotchOnly:{value:t.blotch?.only===`floor`?1:t.blotch?.only===`wall`?2:0},uSlPuddle:{value:new y(t.puddle?.scale??1,t.puddle?.threshold??1,t.puddle?.wetDarken??0)},uSlReflTex:{value:t.reflection?.texture??null},uSlReflMatrix:{value:t.reflection?.matrix??new Pe},uSlRefl:{value:new k(t.reflection?.strength??0,t.reflection?.distort??0,t.reflection?.posterize??0,t.reflection?.fresnel??0)},uSlReflTint:{value:new q(t.reflection?.tint??16777215)},uSlReflKey:{value:new m(t.reflection?.key??0,t.reflection?.keySoft??.05)},uSlWater:{value:new k(t.underwater?.level??0,t.underwater?.depth??1,t.underwater?.caustics??0,0)},uSlWaterColor:{value:new q(t.underwater?.color??0)}};n.userData.sl=u,n.userData.slOptions=t,t.name&&(n.name=t.name);let d=`sl:`+Object.keys(c).sort().join(`,`);return n.customProgramCacheKey=()=>d,n.onBeforeCompile=e=>{Object.assign(e.uniforms,z,u),e.vertexShader=Bi(e.vertexShader),e.fragmentShader=Hi(e.fragmentShader)},n}function Ri(e,t,n){let r=e,i=r.userData.slOptions,a=r.userData.sl;if(!i||!a)return;Object.assign(i,n);let o=new q(i.color);r.color.copy(o);let s=e=>new y(e.r/Math.max(o.r,1e-4),e.g/Math.max(o.g,1e-4),e.b/Math.max(o.b,1e-4));a.uSlRatioShade.value=s(i.shade===void 0?ge(i.color,t.toon.shade):new q(i.shade)),a.uSlRatioDark.value=s(i.dark===void 0?ge(i.color,t.toon.dark):new q(i.dark)),a.uSlRatioHi.value=s(i.hi===void 0?ge(i.color,t.toon.hi):new q(i.hi))}function zi(e,t,n){let r=e.indexOf(t);if(r<0)throw Error(`StyleMaterial: chunk not found: `+t);return e.slice(0,r)+n+e.slice(r+t.length)}function Bi(e){return e=zi(e,`#include <common>`,`#include <common>
varying vec3 vSlWorld;`),e=zi(e,`#include <project_vertex>`,`#include <project_vertex>
  {
    vec4 slw = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      slw = batchingMatrix * slw;
    #endif
    #ifdef USE_INSTANCING
      slw = instanceMatrix * slw;
    #endif
    vSlWorld = (modelMatrix * slw).xyz;
  }`),e}var Vi=`
uniform vec3 uFogHorizon;
uniform vec3 uFogZenith;
uniform vec3 uFogGround;
uniform vec4 uFogParams;
uniform vec4 uFogParams2;
uniform vec3 uFogGlowColor;
uniform vec3 uFogGlowDir;
uniform vec3 uFogExtinction;
vec3 sl_fogColor(vec3 rd) {
  float e = rd.y;
  vec3 c = e >= 0.0 ? mix(uFogHorizon, uFogZenith, smoothstep(0.0, 0.55, e)) : mix(uFogHorizon, uFogGround, smoothstep(0.0, 0.35, -e));
  if (uFogParams2.z > 0.0) c += uFogGlowColor * uFogParams2.z * pow(max(dot(rd, uFogGlowDir), 0.0), uFogParams2.w);
  return c;
}
// 光学的な厚さ（霧の濃さ × 距離）
float sl_fogOptical(vec3 wp, vec3 ro) {
  vec3 rd = wp - ro;
  float dist = length(rd);
  rd /= max(dist, 1e-5);
  float d = max(dist - uFogParams.w, 0.0);
  float dens = uFogParams.x;
  float b = uFogParams.y;
  if (b > 0.0) {
    float h0 = ro.y + rd.y * min(dist, uFogParams.w) - uFogParams.z;
    float k = dens * exp(-b * h0);
    float by = b * rd.y * d;
    float integ = abs(by) > 1e-4 ? (1.0 - exp(-by)) / (b * rd.y) : d;
    return k * integ;
  }
  return dens * d;
}
// 霧を掛ける。steps > 0 なら段にする（境目はワールド座標のノイズでずらす）
vec3 sl_applyFog(vec3 col, vec3 wp, vec3 ro) {
  float od = sl_fogOptical(wp, ro);
  float fa = 1.0 - exp(-od);
  if (uFogParams2.y > 0.0) {
    float st = uFogParams2.y;
    float nz = sl_warp(wp * 0.35, 3) * 0.7;
    fa = clamp(floor(fa * st + 0.5 + nz) / st, 0.0, 0.9999);
    od = -log(1.0 - fa);
  }
  fa = min(fa, uFogParams2.x);
  vec3 T = max(exp(-od * uFogExtinction), vec3(1.0 - uFogParams2.x));
  return col * T + sl_fogColor(normalize(wp - ro)) * fa;
}
`;function Hi(e){e=zi(e,`#include <common>`,`#include <common>
layout(location = 1) out highp vec4 gInfo;
varying vec3 vSlWorld;
uniform float uTime;
uniform float uToonAmount;
uniform vec4 uToonThresh;
uniform vec2 uToonNoise;
uniform float uToonBounce;
uniform float uSlBounce;
uniform float uSlQuant;
uniform float uShadowQuant;
uniform float uShadowJitter;
uniform mat4 uSunShadowMatrix;
uniform float uSunShadowNormalBias;
uniform vec3 uSlRatioShade;
uniform vec3 uSlRatioDark;
uniform vec3 uSlRatioHi;
uniform float uSlToon;
uniform vec2 uSlNoiseMul;
uniform float uSlSpecKill;
uniform float uSlLine;
uniform float uSlId;
uniform vec4 uSlTile;
uniform vec3 uSlTileOffset;
uniform vec3 uSlTileColor;
uniform vec4 uSlFleck;
uniform vec3 uSlFleckColor;
uniform vec3 uSlFleckColor2;
uniform float uSlFleckDensity2;
uniform vec4 uSlBlotch;
uniform vec2 uSlBlotchY;
uniform vec3 uSlBlotchO;
uniform vec3 uSlBlotchLin;
uniform vec3 uSlBlotchAbs;
uniform vec3 uSlBlotchColor;
uniform float uSlBlotchOnly;
uniform vec3 uSlPuddle;
uniform sampler2D uSlReflTex;
uniform mat4 uSlReflMatrix;
uniform vec4 uSlRefl;
uniform vec3 uSlReflTint;
uniform vec2 uSlReflKey;
uniform vec4 uSlWater;
uniform vec3 uSlWaterColor;
${xi}
${Si}
${Ci}
${Vi}
${Ni}
// 1 つ目の平行光源の影（灯りにも効かせる）。lights_fragment_begin の影の計算で入れる
float slSunShadow = 1.0;
float sl_recShadow(float v, int idx) {
  if (idx == 0) slSunShadow = v;
  return v;
}
vec3 sl_geoNormal() {
  vec3 n = normalize(cross(dFdx(vSlWorld), dFdy(vSlWorld)));
  if (dot(n, cameraPosition - vSlWorld) < 0.0) n = -n;
  return n;
}
vec4 sl_shadowCoord(vec4 c, int idx) {
  if (idx != 0 || uSlQuant <= 0.0 || (uShadowQuant <= 0.0 && uShadowJitter <= 0.0)) return c;
  vec3 wn = sl_geoNormal();
  vec3 a = abs(wn);
  vec3 q = vSlWorld;
  if (uShadowJitter > 0.0) {
    // 影の縁をちぎる: 調べる位置を面に沿ってノイズでずらす
    vec3 j = vec3(sl_fbm(q * 2.7, 3), sl_fbm(q * 2.7 + 11.3, 3), sl_fbm(q * 2.7 + 23.1, 3));
    j += 0.35 * vec3(sl_vnoise(q * 19.0), sl_vnoise(q * 19.0 + 5.1), sl_vnoise(q * 19.0 + 9.7));
    j -= wn * dot(j, wn);
    q += j * uShadowJitter;
  }
  if (uShadowQuant > 0.0) {
    vec3 cell = (floor(q / uShadowQuant) + 0.5) * uShadowQuant;
    if (a.y >= a.x && a.y >= a.z) q.xz = cell.xz; else if (a.x >= a.z) q.zy = cell.zy; else q.xy = cell.xy;
  }
  return uSunShadowMatrix * vec4(q + wn * uSunShadowNormalBias, 1.0);
}
float sl_puddleMask() {
  float n = sl_warp(vec3(vSlWorld.xz * uSlPuddle.x, 0.37), 5);
  return step(uSlPuddle.y, n);
}
`);let t=X.lights_fragment_begin,n=t.replace(/getShadow\( directionalShadowMap\[ i \], (.*?), vDirectionalShadowCoord\[ i \] \)/,`sl_recShadow( getShadow( directionalShadowMap[ i ], $1, sl_shadowCoord( vDirectionalShadowCoord[ i ], UNROLLED_LOOP_INDEX ) ), UNROLLED_LOOP_INDEX )`);if(n===t)throw Error(`StyleMaterial: shadow lookup not found in lights_fragment_begin`);return e=zi(e,`#include <lights_fragment_begin>`,n),e=zi(e,`#include <color_fragment>`,`#include <color_fragment>
  vec3 slN = sl_geoNormal();
  vec2 slUV = sl_planarUV(vSlWorld, slN);
  float slPuddle = 0.0;
#ifdef SL_TILES
  {
    vec2 tuv = (slUV + uSlTileOffset.xy) / uSlTile.xy;
    vec2 cell = floor(tuv);
    vec2 f = fract(tuv);
    vec2 lw = uSlTile.z / uSlTile.xy;
    vec2 dl = min(f, 1.0 - f);
    vec2 aa = fwidth(tuv) * 0.75;
    float gx = 1.0 - smoothstep(lw.x * 0.5 - aa.x, lw.x * 0.5 + aa.x, dl.x);
    float gy = 1.0 - smoothstep(lw.y * 0.5 - aa.y, lw.y * 0.5 + aa.y, dl.y);
    float g = max(gx, gy);
    if (uSlTileOffset.z > 0.0) g *= step(uSlTileOffset.z, sl_hash12(cell * 1.37 + floor(f * 3.0)));
    // 遠くでは目地を薄くする（ちらつき防止）
    g *= 1.0 - smoothstep(0.25, 0.6, max(aa.x, aa.y) / max(lw.x, 1e-4) * 0.08);
    float j = (sl_hash12(cell) - 0.5) * uSlTile.w;
    diffuseColor.rgb *= 1.0 + j;
    diffuseColor.rgb = mix(diffuseColor.rgb, uSlTileColor, g);
  }
#endif
#ifdef SL_BLOTCH
  {
    bool ok = uSlBlotchOnly < 0.5 || (uSlBlotchOnly < 1.5 ? slN.y > 0.7 : abs(slN.y) < 0.3);
    if (ok) {
      float th = uSlBlotch.y;
      if (uSlBlotchY.y > uSlBlotchY.x) th += smoothstep(uSlBlotchY.x, uSlBlotchY.y, vSlWorld.y) * uSlBlotch.z;
      vec3 dp = vSlWorld - uSlBlotchO;
      th += dot(dp, uSlBlotchLin) + dot(abs(dp), uSlBlotchAbs);
      float n = sl_warp(vSlWorld * uSlBlotch.x, 5);
      diffuseColor.rgb = mix(diffuseColor.rgb, uSlBlotchColor, step(th, n));
    }
  }
#endif
#ifdef SL_FLECKS
  {
    vec2 p = slUV * uSlFleck.x;
    vec2 cell = floor(p);
    vec2 f = fract(p) - 0.5;
    vec3 h = sl_hash33(vec3(cell, floor(dot(slN, vec3(1.0, 2.0, 3.0)) * 7.0)));
    vec2 c = (h.xy - 0.5) * 0.6;
    vec2 d = abs(f - c);
    float len = uSlFleck.z * (0.4 + h.z);
    float on = step(d.x, uSlFleck.w) * step(d.y, len * 0.5);
    if (h.z < uSlFleck.y) diffuseColor.rgb = mix(diffuseColor.rgb, uSlFleckColor, on);
#ifdef SL_FLECKS2
    else if (h.z > 1.0 - uSlFleckDensity2) diffuseColor.rgb = mix(diffuseColor.rgb, uSlFleckColor2, on);
#endif
  }
#endif
#ifdef SL_PUDDLE
  slPuddle = slN.y > 0.7 ? sl_puddleMask() : 0.0;
  diffuseColor.rgb *= 1.0 - uSlPuddle.z * (1.0 - slPuddle);
#endif
#ifdef SL_UNDERWATER
  float slUnder = max(uSlWater.x - vSlWorld.y, 0.0);
#endif
`),e=zi(e,`#include <aomap_fragment>`,`#include <aomap_fragment>
#ifdef SL_UNLIT
  reflectedLight.directDiffuse = diffuseColor.rgb;
  reflectedLight.indirectDiffuse = vec3(0.0);
  reflectedLight.directSpecular = vec3(0.0);
  reflectedLight.indirectSpecular = vec3(0.0);
#endif
#if !defined(SL_UNLIT)
  vec3 slLamp = uLampCount > 0.0 ? sl_lamps(vSlWorld, slN, slSunShadow) * uLampParams.x : vec3(0.0);
#endif
#if !defined(SL_TOON) && !defined(SL_UNLIT)
  reflectedLight.directDiffuse += diffuseColor.rgb * slLamp;
#endif
#ifdef SL_TOON
  {
    vec3 F = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb * RECIPROCAL_PI * PI, vec3(1e-4));
    float s = sl_luma(F);
    s += (uSlBounce >= 0.0 ? uSlBounce : uToonBounce) * max(-slN.y, 0.0);
    float slLampL = sl_luma(slLamp);
    s += slLampL;
    float amt = uToonAmount * uSlToon;
    if (amt > 0.0) {
      float nz = sl_warp(vSlWorld * uToonNoise.y * uSlNoiseMul.y, 4);
      s *= exp2(nz * uToonNoise.x * uSlNoiseMul.x * 4.0);
      float soft = uToonThresh.w;
      vec3 base = diffuseColor.rgb;
      vec3 col = base * uSlRatioDark;
      col = mix(col, base * uSlRatioShade, sl_aastep(uToonThresh.z, s, soft));
      col = mix(col, base, sl_aastep(uToonThresh.y, s, soft));
      col = mix(col, base * uSlRatioHi, sl_aastep(uToonThresh.x, s, soft));
      // 灯りの色へ少し寄せる（灯りの強い所ほど）
      if (slLampL > 1e-3) col = mix(col, col * slLamp / slLampL, uLampParams.y * min(slLampL, 1.0));
      reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, col, amt);
      reflectedLight.indirectDiffuse *= 1.0 - amt;
      reflectedLight.directSpecular *= 1.0 - amt * uSlSpecKill;
      reflectedLight.indirectSpecular *= 1.0 - amt * uSlSpecKill;
    }
  }
#endif
#ifdef SL_UNDERWATER
  {
    vec3 vdir = normalize(vSlWorld - cameraPosition);
    float path = slUnder + slUnder / max(abs(vdir.y), 0.2);
    float k = 1.0 - exp(-path / max(uSlWater.y, 1e-3));
    vec3 tot = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    vec3 tinted = mix(tot, uSlWaterColor, k);
    if (uSlWater.z > 0.0 && slUnder > 0.0) {
      vec2 v = sl_voronoi(vec3(vSlWorld.xz * 1.6, uTime * 0.35));
      float c = smoothstep(0.05, 0.0, v.y - v.x);
      tinted += uSlWaterColor * c * uSlWater.z * (1.0 - k * 0.5);
    }
    reflectedLight.directDiffuse = tinted;
    reflectedLight.indirectDiffuse = vec3(0.0);
  }
#endif
`),e=zi(e,`#include <opaque_fragment>`,`#ifdef SL_REFLECT
  {
    float m = 1.0;
#ifdef SL_REFLECT_PUDDLE
    m = slPuddle;
#endif
    if (m > 0.0) {
      vec4 pc = uSlReflMatrix * vec4(vSlWorld, 1.0);
      vec2 ruv = pc.xy / pc.w;
      if (uSlRefl.y > 0.0) {
        vec3 q = vec3(vSlWorld.xz * 1.7, uTime * 0.25);
        ruv += vec2(sl_fbm(q, 3), sl_fbm(q + 7.3, 3)) * uSlRefl.y;
      }
      vec3 r = texture2D(uSlReflTex, ruv).rgb * uSlReflTint;
      if (uSlRefl.z > 0.0) {
        vec3 lab = sl_linToOklab(r);
        float lev = uSlRefl.z;
        float nz = sl_fbm(vec3(vSlWorld.xz * 2.3, uTime * 0.2), 3) * 0.6;
        lab.x = (floor(lab.x * lev + 0.5 + nz) / lev);
        r = sl_oklabToLin(lab);
      }
      if (uSlReflKey.x > 0.0) m *= smoothstep(uSlReflKey.x - uSlReflKey.y, uSlReflKey.x + uSlReflKey.y, sl_luma(r));
      vec3 vd = normalize(cameraPosition - vSlWorld);
      float fr = mix(1.0, pow(1.0 - max(vd.y, 0.0), 3.0) * 0.85 + 0.15, uSlRefl.w);
      outgoingLight = mix(outgoingLight, r, clamp(uSlRefl.x * fr * m, 0.0, 1.0));
    }
  }
#endif
#include <opaque_fragment>`),e=zi(e,`#include <fog_fragment>`,`#ifndef SL_NOFOG
  gl_FragColor.rgb = sl_applyFog(gl_FragColor.rgb, vSlWorld, cameraPosition);
#endif
  {
    vec3 vn = normalize(normal);
    gInfo = vec4(vn.xy * 0.5 + 0.5, uSlId, uSlLine * gl_FragColor.a);
  }`),e}function Ui(e={}){let t=new Y(900,48,24),n=new me({uniforms:{...z,uClouds:{value:e.clouds??0},uCloudColor:{value:new q(e.cloudColor??16777215)},uCloudBand:{value:new m(...e.cloudBand??[.12,.12])},uCloudScale:{value:e.cloudScale??3},uSkyGain:{value:new y(e.gain??1,e.tintAmount??0,e.horizonBlend??.08)},uSkyTint:{value:new q(e.tint??16777215)}},vertexShader:`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,fragmentShader:`
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vDir;
      uniform float uTime;
      uniform float uClouds;
      uniform vec3 uCloudColor;
      uniform vec2 uCloudBand;
      uniform float uCloudScale;
      uniform vec3 uSkyGain;
      uniform vec3 uSkyTint;
      ${xi}
      ${Si}
      ${Vi}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = sl_fogColor(d);
        if (uClouds > 0.0) {
          float band = 1.0 - smoothstep(0.0, uCloudBand.y, abs(d.y - uCloudBand.x));
          vec2 p = d.xz / max(d.y + 0.25, 0.05) * uCloudScale;
          float n = sl_fbm(vec3(p, uTime * 0.01), 5) * 0.5 + 0.5;
          c = mix(c, uCloudColor, smoothstep(0.45, 0.8, n) * band * uClouds);
        }
        if (uSkyGain.x != 1.0 || uSkyGain.y > 0.0) {
          float k = smoothstep(0.0, max(uSkyGain.z, 1e-3), d.y);
          c = mix(c, mix(c * uSkyGain.x, uSkyTint, uSkyGain.y), k);
        }
        gl_FragColor = vec4(c, 1.0);
        gInfo = vec4(0.5, 0.5, 0.0, 0.0);
      }`,side:1,depthWrite:!1,fog:!1}),r=new U(t,n);return r.name=`sky`,r.renderOrder=-1e3,r.frustumCulled=!1,r.onBeforeRender=(e,t,n)=>{r.position.setFromMatrixPosition(n.matrixWorld),r.updateMatrixWorld()},r}function Wi(e){if(e.poly)return e.poly;let[t,n,r,i]=e.rect;return[[t,n],[r,n],[r,i],[t,i]]}function Gi(e,t=[]){let n=1/0,r=1/0,i=-1/0,a=-1/0,o=e=>{n=Math.min(n,e[0]),r=Math.min(r,e[1]),i=Math.max(i,e[0]),a=Math.max(a,e[1])};for(let t of e.spaces)Wi(t).forEach(o);for(let t of e.walls??[])o(t.a),o(t.b);return t.forEach(o),[n,r,i,a]}var Ki={corridor:`#cfd8c4`,room:`#e7e1cc`,hall:`#d8e4dc`,stair:`#c9b8d8`,lift:`#b8b8d8`,platform:`#c8d2d6`,track:`#8a8f86`,water:`#7cc7c0`,outdoor:`#a8c49a`,service:`#b9b2a6`,void:`#3a4044`};function qi(t,n,r={}){let i=r.views??[],a=r.compact?2:4,o=r.bounds??Gi(t,i.map(e=>[e.eye[0],e.eye[2]])),s=o[0]-a,c=o[1]-a,l=o[2]+a,u=o[3]+a,d=r.px??1400,f=Math.min(d/(l-s),d/(u-c)),p=Math.round((l-s)*f),m=Math.round((u-c)*f);(n.width!==p||n.height!==m)&&(n.width=p,n.height=m);let h=n.getContext(`2d`),g=(e,t)=>[(e-s)*f,(t-c)*f];if(h.fillStyle=`#14191b`,h.fillRect(0,0,p,m),r.under){let[e,t,n,i]=r.under.bounds,[a,o]=g(e,t),[s,c]=g(n,i);h.globalAlpha=.85,h.drawImage(r.under.image,a,o,s-a,c-o),h.globalAlpha=1}if(!r.compact){for(let e=Math.ceil(s);e<=l;e++)h.strokeStyle=e%5==0?`rgba(255,255,255,0.10)`:`rgba(255,255,255,0.04)`,h.beginPath(),h.moveTo(...g(e,c)),h.lineTo(...g(e,u)),h.stroke();for(let e=Math.ceil(c);e<=u;e++)h.strokeStyle=e%5==0?`rgba(255,255,255,0.10)`:`rgba(255,255,255,0.04)`,h.beginPath(),h.moveTo(...g(s,e)),h.lineTo(...g(l,e)),h.stroke()}let _=e=>r.level===void 0||(e??0)===r.level;for(let e of t.spaces){if(!_(e.level))continue;let t=Wi(e);if(h.beginPath(),t.forEach((e,t)=>t?h.lineTo(...g(e[0],e[1])):h.moveTo(...g(e[0],e[1]))),h.closePath(),h.globalAlpha=r.under?.25:.85,h.fillStyle=Ki[e.kind],h.fill(),h.globalAlpha=1,h.lineWidth=r.compact?1:1.5,h.strokeStyle=e.closed?`#6b5a4a`:`#2a3236`,r.under&&(h.strokeStyle=`#ffffff`),h.setLineDash(e.closed?[4,3]:[]),h.stroke(),h.setLineDash([]),!r.compact){let[n,i]=g(t.reduce((e,t)=>e+t[0],0)/t.length,t.reduce((e,t)=>e+t[1],0)/t.length);h.fillStyle=r.under?`#ffffff`:`#1d2427`,h.font=`${Math.max(10,Math.min(14,f*.9))}px sans-serif`,h.textAlign=`center`,h.fillText(e.label,n,i),h.font=`10px sans-serif`,h.fillStyle=r.under?`#dddddd`:`#4a5357`,h.fillText(`床 ${e.floor}${e.ceiling===void 0?``:` / 天井 ${e.ceiling}`} m`,n,i+13),h.textAlign=`start`}}for(let e of t.walls??[])_(e.level)&&(h.strokeStyle=e.kind===`glass`?`#7fd0e6`:e.kind===`fence`||e.kind===`railing`?`#c8b46a`:`#1a1f22`,r.under&&(h.strokeStyle=e.kind===`glass`?`#7fd0e6`:`#ffffff`),h.lineWidth=e.kind===`wall`||!e.kind?Math.max(2,f*.2):2,h.beginPath(),h.moveTo(...g(...e.a)),h.lineTo(...g(...e.b)),h.stroke());for(let e of t.openings){if(!_(e.level))continue;let[t,n]=g(e.at[0],e.at[1]),i=e.width/2*f,a=e.state===`locked`?`#e05a4f`:e.state===`closed`?`#e0a64f`:`#58c46b`;h.strokeStyle=a,h.lineWidth=r.compact?2:3,h.beginPath();let o=e.wall===`x`?0:e.wall===`z`?Math.PI/2:e.wall;h.moveTo(t-Math.cos(o)*i,n-Math.sin(o)*i),h.lineTo(t+Math.cos(o)*i,n+Math.sin(o)*i),h.stroke(),!r.compact&&e.kind!==`opening`&&(h.fillStyle=a,h.font=`9px sans-serif`,h.fillText(e.kind,t+3,n-3))}!r.compact&&t.tour.length&&(h.strokeStyle=`rgba(120,180,255,0.8)`,h.lineWidth=1.5,h.setLineDash([6,4]),h.beginPath(),t.tour.forEach((e,t)=>t?h.lineTo(...g(e.eye[0],e.eye[2])):h.moveTo(...g(e.eye[0],e.eye[2]))),h.stroke(),h.setLineDash([]),t.tour.forEach((e,t)=>{let[n,r]=g(e.eye[0],e.eye[2]);h.fillStyle=`#78b4ff`,h.beginPath(),h.arc(n,r,4,0,Math.PI*2),h.fill(),h.font=`10px sans-serif`,h.fillText(String(t+1),n+5,r+4)}));for(let t of i){let[n,i]=g(t.eye[0],t.eye[2]),a=Math.atan(Math.tan(e.degToRad(t.fov)/2)*(1456/816)),o=r.compact?10*f:Math.max(40,18*f);if(h.fillStyle=`rgba(255, 204, 51, 0.18)`,h.strokeStyle=`#ffcc33`,h.lineWidth=1.5,h.beginPath(),h.moveTo(n,i),t.reach?.length){let e=t.reach.length-1;for(let r=0;r<=e;r++){let o=t.yaw-a+2*a*r/e,s=t.reach[r]*f;h.lineTo(n-Math.sin(o)*s,i-Math.cos(o)*s)}}else for(let e of[-1,1]){let r=t.yaw+e*a;h.lineTo(n-Math.sin(r)*o,i-Math.cos(r)*o)}h.closePath(),h.fill(),h.stroke(),r.compact||(h.fillStyle=`#ffcc33`,h.font=`bold 12px sans-serif`,h.fillText(t.id,n+6,i+14))}if(r.player){let[e,t]=g(r.player.x,r.player.z);h.fillStyle=`#ff4fa0`,h.beginPath(),h.arc(e,t,r.compact?4:6,0,Math.PI*2),h.fill(),h.strokeStyle=`#ff4fa0`,h.lineWidth=2,h.beginPath(),h.moveTo(e,t),h.lineTo(e-Math.sin(r.player.yaw)*14,t-Math.cos(r.player.yaw)*14),h.stroke()}if(!r.compact){let e=10*f;h.fillStyle=`#ffffff`,h.fillRect(12,m-18,e,3),h.font=`11px sans-serif`,h.fillText(`10 m`,12,m-24),h.font=`bold 13px sans-serif`,h.fillText(`${t.title}${r.level===void 0?``:`（${r.level} 階）`}`,12,18),h.font=`11px sans-serif`,h.fillStyle=`#c8d0cc`,h.fillText(`上が奥（-Z）・黄 = 参考画像の視点・青 = 歩いて確かめる道順・緑 / 橙 / 赤 = 開いた / 閉じた / 鍵の開口`,12,34)}}var Ji=728,Yi=408;function Xi(e){let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4}function Zi(e,t,n){let r=Math.cbrt(.4122214708*e+.5363325363*t+.0514459929*n),i=Math.cbrt(.2119034982*e+.6806995451*t+.1073969566*n),a=Math.cbrt(.0883024619*e+.2817188376*t+.6299787005*n);return[.2104542553*r+.793617785*i-.0040720468*a,1.9779984951*r-2.428592205*i+.4505937099*a,.0259040371*r+.7827717662*i-.808675766*a]}function Qi(e){let t=document.createElement(`canvas`);t.width=Ji,t.height=Yi;let n=t.getContext(`2d`,{willReadFrequently:!0});n.imageSmoothingQuality=`high`,n.drawImage(e,0,0,Ji,Yi);let r=n.getImageData(0,0,Ji,Yi).data,i=new Float32Array(Ji*Yi),a=new Float32Array(Ji*Yi),o=new Float32Array(Ji*Yi);for(let e=0;e<Ji*Yi;e++){let[t,n,s]=Zi(Xi(r[e*4]),Xi(r[e*4+1]),Xi(r[e*4+2]));i[e]=t,a[e]=n,o[e]=s}return{L:i,A:a,B:o}}function $i(e,t,n,r){let i=Math.floor(t/r),a=Math.floor(n/r),o=new Float32Array(i*a);for(let n=0;n<a;n++)for(let a=0;a<i;a++){let s=0;for(let i=0;i<r;i++)for(let o=0;o<r;o++)s+=e[(n*r+i)*t+a*r+o];o[n*i+a]=s/(r*r)}return{d:o,w:i,h:a}}function ea(e,t,n){let r=new Float32Array(t*n);for(let i=1;i<n-1;i++)for(let n=1;n<t-1;n++){let a=i*t+n,o=e[a-t+1]+2*e[a+1]+e[a+t+1]-e[a-t-1]-2*e[a-1]-e[a+t-1],s=e[a+t-1]+2*e[a+t]+e[a+t+1]-e[a-t-1]-2*e[a-t]-e[a-t+1];r[a]=Math.hypot(o,s)/4}return r}function ta(e,t=16){let n=[];for(let t of e)for(let e=0;e<t.L.length;e+=37)n.push([t.L[e],t.A[e],t.B[e]]);n.sort((e,t)=>e[0]-t[0]);let r=Array.from({length:t},(e,r)=>[...n[Math.floor((r+.5)/t*n.length)]]),i=new Int32Array(n.length);for(let e=0;e<12;e++){for(let e=0;e<n.length;e++){let a=0,o=1/0;for(let i=0;i<t;i++){let t=(n[e][0]-r[i][0])**2+(n[e][1]-r[i][1])**2+(n[e][2]-r[i][2])**2;t<o&&(o=t,a=i)}i[e]=a}let e=r.map(()=>[0,0,0,0]);for(let t=0;t<n.length;t++){let r=e[i[t]];r[0]+=n[t][0],r[1]+=n[t][1],r[2]+=n[t][2],r[3]++}for(let n=0;n<t;n++)e[n][3]>0&&(r[n]=[e[n][0]/e[n][3],e[n][1]/e[n][3],e[n][2]/e[n][3]])}return r}function na(e,t){let{L:n,A:r,B:i}=e,a=Ji*Yi,o=ea(n,Ji,Yi),s=0,c=0;for(let e=0;e<a;e++)o[e]>.025&&s++,o[e]<.006&&c++;let l=$i(n,Ji,Yi,8),u=ea(l.d,l.w,l.h),d=0;for(let e=0;e<u.length;e++)u[e]>.02&&d++;let f=$i(n,Ji,Yi,32),p=0;for(let e of f.d)p+=e;p/=f.d.length;let m=0;for(let e of f.d)m+=(e-p)**2;let h=Float32Array.from(n).sort(),g=h[Math.floor(a*.95)]-h[Math.floor(a*.05)],_=0;for(let e=0;e<a;e++)_+=Math.hypot(r[e],i[e]);let v=0;if(t){let e=0;for(let o=0;o<a;o+=7){let a=1/0;for(let e of t)a=Math.min(a,(n[o]-e[0])**2+(r[o]-e[1])**2+(i[o]-e[2])**2);v+=Math.sqrt(a),e++}v/=e}let y=(e,t=1e3)=>Math.round(e*t)/t;return{detail:y(s/a),shape:y(d/u.length),light:y(Math.sqrt(m/f.d.length)),contrast:y(g),flat:y(c/a),chroma:y(_/a),palette:y(v*100,10)}}function ra(e){let t=e>>>0||1;return()=>(t^=t<<13,t^=t>>>17,t^=t<<5,(t>>>0)/4294967296)}var $=(e,t,n,r,i=!1)=>({kind:`number`,default:e,min:t,max:n,note:r,...i?{integer:i}:{}}),ia=(e,t)=>({kind:`boolean`,default:e,note:t}),aa={"move.climb.speed":$(2,.5,5,`はしご: 上り下りの速さ（m/s）`),"move.swim.speed":$(1.9,.5,5,`泳ぐ: 水平の速さ（m/s）`),"move.swim.dashSpeed":$(2.5,.5,6,`泳ぐ: 走る操作のときの水平の速さ（m/s）`),"move.swim.depth":$(1.2,.6,2,`泳ぐ: 足元から水面までがこれより深いと泳ぐ（m。浅ければ水の中を歩く）`),"move.swim.float":$(1.38,1,1.7,`泳ぐ: 浮いたときの足元の深さ（m。目が水面の少し上に出る）`),"move.swim.rise":$(1.7,.5,4,`泳ぐ: 跳ぶ操作で浮き上がる速さ（m/s）`),"move.swim.dive":$(1.6,.5,4,`泳ぐ: しゃがむ操作で潜る速さ（m/s）`),"move.swim.mantle":$(.65,.2,1.2,`泳ぐ: 水面からこの高さまでの縁なら、前へ押すと這い上がれる（m）`),"move.grav.holdSec":$(.2,.05,1,`重力の向き: 磁力の面へ向かって押し続けると乗り移るまでの秒数`),"move.grav.leaveSec":$(.15,.05,1,`重力の向き: 磁力の面から足が離れて、普通の重力に戻るまでの秒数`),"move.scale.rate":$(1.6,.2,6,`身体の大きさ: 大きさが変わる速さ（倍率 / 秒）`),"move.updraft.accel":$(4,.5,20,`上昇気流: 上向きの流れの速さへ近づく強さ（/ 秒）`),"move.wind.gust":$(4.6,3,12,`送風の通路: 突風の速さ（m/s）。歩く（3）より強いので開けた所では押し戻され、立ち止まると入口まで飛ばされる。ダッシュ（5.5）なら少しずつ進める`),"move.wind.breeze":$(.6,0,3,`送風の通路: 突風の間の弱い風（m/s）`),"move.wind.period":$(4.6,2,12,`送風の通路: 突風の周期（秒）`),"move.wind.duty":$(.4,.1,.8,`送風の通路: 周期のうち突風の割合`),"move.wind.warn":$(.9,0,3,`送風の通路: 突風の予告（送風機がうなる）の秒数`),"move.wind.air":$(1.6,1,4,`送風の通路: 宙にいる間の風の倍率（跳ぶと飛ばされる）`),"move.wind.landingM":$(1.4,1,2.5,`送風の通路: 入口の前の風の来ない奥行き（m）`),"move.wind.pitchM":$(2.6,1.8,4,`送風の通路: 風よけの仕切りの間隔（m）`),"move.wind.blownSec":$(.45,.2,3,`送風の通路（出現型の隠し）: 突風の中で宙にいる秒数`),"move.crowd.chance":$(.35,0,1,`送風の通路: 人の流れ（見えない群衆）の変種になる確率（幅 3 m 以上の部屋）`),"move.crowd.speed":$(2.2,.5,2.6,`人の流れ: 横切る流れの速さ（m/s）。歩く速さより弱く（流されながら渡れる）`),"move.crowd.laneM":$(1.3,.8,2.5,`人の流れ: 流れの帯の幅（m）`),"move.crowd.period":$(3.4,1.5,10,`人の流れ: 流れが強まる周期（秒）`),"move.crowd.duty":$(.5,.1,.9,`人の流れ: 周期のうち流れのある割合`),"move.foot.w.ice":$(.45,0,10,`足元の部屋: 氷の重み`),"move.foot.w.wax":$(.25,0,10,`足元の部屋: 磨いて濡れた床の重み`),"move.foot.w.mud":$(.3,0,10,`足元の部屋: 泥の重み`),"move.foot.iceFriction":$(.22,.05,1,`氷: 足の効き（1 が普通。小さいほど止まれない）`),"move.foot.waxFriction":$(.35,.05,1,`滑る床: 足の効き`),"move.foot.holeDepthM":$(1.2,.6,2.5,`氷・滑る床: 落ちると入口からの穴の深さ（m）`),"move.foot.matM":$(.95,.6,1.6,`氷・滑る床: 止まれる敷物の大きさ（m）`),"move.foot.mats":$(5,1,12,`氷・滑る床: 止まれる敷物の数の上限`,!0),"move.foot.mudSlow":$(.4,.15,.9,`泥: 歩く速さの倍率`),"move.foot.mudSink":$(.2,0,.6,`泥: 足が沈む深さ（m。目が下がる）`),"move.foot.quickM":$(1.4,.8,2.5,`泥: 流砂の大きさ（m）`),"move.foot.quickSec":$(1.8,.5,6,`泥: 流砂で立ち止まって飲み込まれるまでの秒数`),"move.crawl.shrinkChance":$(.5,0,1,`這う部屋: 縮むトンネルになる確率（入口と出口が向かい合う細長い部屋。ほかはダクト）`),"move.crawl.widthM":$(.95,.8,1.4,`這う部屋: 這う所の幅（m）`),"move.crawl.heightM":$(1,.9,1.3,`這う部屋: 這う所の高さ（m。しゃがみの高さ 0.85 m より高く）`),"move.crawl.backwardSec":$(2,.5,8,`縮むトンネル（出現型の隠し）: 立ったまま後ろ向きに歩き続ける秒数`),"move.backward.push":$(5,3.2,10,`後ろ向きの通路: 前を向いたときに押し戻す速さ（m/s。歩く 3 より強く）`),"move.backward.coneDeg":$(65,30,89,`後ろ向きの通路: 前からこの角度の内を向いていると押される`),"move.stretch.periodM":$(1.8,1.2,3,`伸びる廊下: 柱と照明の間隔（m）。歩いて境目を越えると、この長さだけ戻される`),"move.stretch.stillSec":$(1,.3,4,`伸びる廊下: 立ち止まってから前へ滑り始めるまでの秒数`),"move.stretch.glide":$(1.3,.5,3,`伸びる廊下: 立ち止まっている間に前へ滑る速さ（m/s）`),"move.chasm.depthM":$(2.7,2.2,3.05,`溝・穴の部屋: 穴の深さ（m。3.1 m 以上は隠し部屋が隣の区画の下に入り込む）`),"move.chasm.tileM":$(1,.6,1.6,`抜ける床: 床板の大きさ（m）`),"move.chasm.trapSpeed":$(2.1,1.7,2.8,`抜ける床: これより速く動くと床板が軋んで開く（m/s。しゃがみ歩き 1.5 と歩く 3.0 の間）`),"move.chasm.trapCreakSec":$(.12,0,.5,`抜ける床: 速く動き続けて開くまでの軋み（秒）`),"move.chasm.trapStillSec":$(2,.8,6,`抜ける床: 床板の上で立ち止まって開くまで（秒）`),"move.chasm.trapOpenSec":$(3,1,10,`抜ける床: 開いた床板が閉じるまで（秒）`),"move.chasm.ghostCellM":$(.95,.9,1.4,`見えない足場: 足場の 1 升の大きさ（m）`),"move.chasm.bridgeW":$(.85,.75,1.4,`吊り橋: 橋板の幅（m）`),"move.chasm.swayGain":$(4,.5,20,`吊り橋: 歩くより速く動いたときに揺れが大きくなる強さ（度 / 秒 /（m/s）²）`),"move.chasm.swayMaxDeg":$(16,4,30,`吊り橋: 揺れの傾きの上限（度）`),"move.chasm.swayPush":$(.6,.1,2,`吊り橋: 傾きで横へ押す強さ（重さに対する割合）`),"move.chasm.walkW":$(1.2,.9,2,`振り子の通路: 橋の幅（m）`),"move.chasm.pendulumPitch":$(1.9,1.5,3,`振り子の通路: 振り子の間隔（m。間で待てる）`),"move.chasm.pendulumPeriod":$(2.6,1.6,5,`振り子の通路: 振り子の周期（秒）`),"move.chasm.rideSec":$(1.2,.3,5,`振り子の通路（出現型の隠し）: 振り子の板に乗っている秒数`),"move.rise.w.springs":$(.4,0,10,`高い所へ上がる部屋: 弾む床の重み`),"move.rise.w.updraft":$(.3,0,10,`高い所へ上がる部屋: 上昇気流の重み`),"move.rise.w.ladder":$(.3,0,10,`高い所へ上がる部屋: はしごの重み`),"move.rise.stepM":$(1.25,1,1.8,`高い所へ上がる部屋: 棚 1 段の高さ（m。跳んで届く 0.9 m より高く）`),"move.rise.ledgeDepthM":$(1.5,1.1,2.2,`高い所へ上がる部屋: 棚の奥行き（m）`),"move.rise.ledgeLenM":$(2,1.6,3,`高い所へ上がる部屋: 棚 1 段の長さ（m）`),"move.rise.overshootM":$(.7,.3,1.5,`弾む床: 次の棚より高く跳ね上がる分（m）`),"move.rise.updraftSpeed":$(3.2,1.5,6,`上昇気流: 吹き上がる速さ（m/s）`),"move.escalator.depthM":$(1.8,1.4,3,`逆走エスカレーター: 穴の深さ（m。エスカレーターで上る高さ）`),"move.escalator.speed":$(2.3,1,2.39,`逆走エスカレーター: 下りに動く速さ（m/s）。歩く 3.0 より少し遅く（歩くと少しずつ、走るとゆっくり上れる）`),"move.escalator.landingM":$(.9,.7,1.6,`逆走エスカレーター: 途中の踊り場の長さ（m）`),"move.escalator.stillSec":$(2.5,.5,8,`逆走エスカレーター（出現型の隠し）: 踊り場で立ち止まる秒数`),"move.slide.depthM":$(2.4,1.8,3,`滑り台: 穴の深さ（m）`),"move.slide.waterChance":$(.5,0,1,`滑り台: 水の流れる滑り台（ウォータースライダー）になる確率`),"move.slide.slopeDeg":$(38,25,45,`滑り台: 傾き（度）`),"move.slide.speed":$(4.5,2.5,8,`滑り台: 滑り落ちる流れの速さ（m/s。歩く速さより強く、上へは戻れない）`),"move.slide.chuteSpeed":$(3,2.5,6,`滑り台（隠し）: 横の溝の流れの速さ（m/s）`),"move.turn.radiusMaxM":$(3.2,1.9,5,`回る床: 円盤の半径の上限（m）`),"move.turn.omega":$(.42,.1,1.2,`回る床: 回る速さ（rad/s。縁で約 1.3 m/s）`),"move.turn.rimSec":$(9,2,30,`回る床（出現型の隠し）: 縁に乗り続ける秒数`),"move.revolve.radiusM":$(1.6,1.3,2.2,`回転扉: 筒の半径（m）`),"move.revolve.walkW":$(1.3,.4,3,`回転扉: 歩いて押したときの回る速さの上限（rad/s）`),"move.revolve.runW":$(2.8,1,5,`回転扉: 走って押したときの回る速さの上限（rad/s）`),"move.revolve.damp":$(.9,.2,4,`回転扉: 手を離した後に回る勢いが弱まる速さ（/ 秒）`),"move.push.travelM":$(1.8,1.2,3,`押せる壁: 板が動く距離（m）`),"move.push.speed":$(.7,.2,2,`押せる壁: 押しているときに動く速さ（m/s）`),"move.tilt.maxDeg":$(12,4,20,`傾いていく部屋: 床の傾きの上限（度）`),"move.tilt.rate":$(1.1,.2,5,`傾いていく部屋: 傾いていく速さ（度 / 秒。人がいなくなると半分の速さで戻る）`),"move.tilt.push":$(.35,0,1,`傾いていく部屋: 傾きで低い側へ押す強さ（重さに対する割合）`),"move.atrium.depthM":$(2,1.6,3.4,`吹き抜け: 穴の深さ（m）`),"move.atrium.w.rope":$(.3,0,10,`吹き抜け: ロープ渡りの重み`),"move.atrium.w.zip":$(.25,0,10,`吹き抜け: ジップラインの重み`),"move.atrium.w.cart":$(.2,0,10,`吹き抜け: 台車の重み`),"move.atrium.w.gondola":$(.25,0,10,`吹き抜け: ゴンドラの重み`),"move.atrium.ropeSpeed":$(1.1,.4,3,`ロープ渡り: つかまって進む速さ（m/s）`),"move.atrium.zipAccel":$(3,.5,10,`ジップライン: 加速（m/s²）`),"move.atrium.zipMax":$(6,2,12,`ジップライン: 速さの上限（m/s）`),"move.atrium.cartAccel":$(2.5,.5,8,`台車: 押されて走る加速（m/s²）`),"move.atrium.cartMax":$(7,2,12,`台車: 速さの上限（m/s）`),"move.atrium.carWait":$(3,1,10,`ゴンドラ: 乗り場で待つ秒数`),"move.pool.depthM":$(2.2,1.6,3,`深いプール: 深さ（m）`),"move.pool.surfaceM":$(.35,.15,.55,`深いプール: 水面が床より低い分（m。這い上がれる高さ move.swim.mantle より低く）`),"move.pool.stoneChance":$(.5,0,1,`深いプール: 跳び石になる確率`),"move.balls.shallowSlow":$(.8,.3,1,`ボールプール: 浅い道の速さの倍率`),"move.balls.deepSlow":$(.42,.15,1,`ボールプール: 深い所の速さの倍率`),"move.balls.jostle":$(.5,0,2,`ボールプール: 深い所で球に押される強さ（m/s）`),"move.balls.diveSec":$(2,.5,8,`ボールプール（出現型の隠し）: いちばん深い所でしゃがんでじっとしている秒数`),"move.heavy.scaleMin":$(1.6,1.2,2.5,`重い部屋: 重さの倍率の下限`),"move.heavy.scaleMax":$(1.85,1.2,2.8,`重い部屋: 重さの倍率の上限`),"move.heavy.slow":$(.78,.4,1,`重い部屋: 歩く速さの倍率`),"move.underwater.slow":$(.6,.3,1,`水の中の部屋: 速さの倍率`),"move.underwater.drag":$(1.8,.5,5,`水の中の部屋: 落ちる速さの上限（m/s）`),"move.underwater.gravity":$(.55,.2,1,`水の中の部屋: 重さの倍率（ふわりと跳ぶ）`),"move.underwater.fogFar":$(10,4,30,`水の中の部屋: 霧の届く距離（m）`),"move.ball.bubbleChance":$(.5,0,1,`球に乗る部屋: バブル（球の中に入る）になる確率`),"move.ball.accel":$(3.5,1,10,`玉乗り: 操作の向きへの加速（m/s²）`),"move.ball.bubbleAccel":$(4.5,1,10,`バブル: 操作の向きへの加速（m/s²）`),"move.ball.vmax":$(5,2,9,`球: 速さの上限（m/s）`),"move.ball.throwSpeed":$(2.6,1,6,`玉乗り: この速さより速く壁にぶつかると振り落とされる（m/s）`),"move.ball.paintSlow":$(.15,.05,.8,`球に乗る部屋: 塗りたてのペンキの床を歩く速さの倍率`),"move.size.small":$(.34,.2,.6,`大きさの門「小」: 身体の大きさの倍率（ネズミの穴 0.7 m を立ったまま通れる）`),"move.size.large":$(1.35,1.1,1.6,`大きさの門「大」: 身体の大きさの倍率（天井 2.6 m の部屋で立てる）`),"move.size.underSec":$(1,.3,5,`身体の大きさ（出現型の隠し）: 小さいまま戸棚の下にいる秒数`),"move.grav.w.loop":$(.4,0,10,`重力の部屋: 床・壁・天井をひと回りする帯（回廊）の重み`),"move.grav.w.maze":$(.3,0,10,`重力の部屋: 床の迷路と天井の道（迷路）の重み`),"move.grav.w.tube":$(.3,0,10,`重力の部屋: 回る筒の通路の重み`),"move.grav.mazeMinH":$(3.3,3,5,`重力の迷路: 天井の高さの下限（m。天井を歩く頭が床の仕切り 1.4 m に当たらない）`),"move.grav.ceilingSec":$(2,.5,8,`重力の回廊（出現型の隠し）: 天井の帯を歩く秒数`)},oa={"ground.collapse.depthM":$(2.8,2.4,3.05,`崩れていく帰り道: 穴の深さ（m）`),"ground.collapse.tileM":$(1,.6,1.6,`崩れていく帰り道: 床板の大きさ（m）`),"ground.collapse.delaySec":$(.1,0,2,`崩れていく帰り道: 装置に触れてから崩れ始めるまで（秒）`),"ground.collapse.shakeSec":$(.3,.1,2,`崩れていく帰り道: 崩れの前線が来てから床板が落ちるまで（秒。揺れて見せる）`),"ground.collapse.margin":$(.5,0,1,`崩れていく帰り道: 前線の速さ（0 = 歩く人をぎりぎり捕まえる / 1 = 走る人をぎりぎり逃がす。部屋の奥行きから速さを決める）`),"ground.collapse.speedMin":$(3.4,2,8,`崩れていく帰り道: 前線の速さの下限（m/s）`),"ground.collapse.speedMax":$(10,2,14,`崩れていく帰り道: 前線の速さの上限（m/s。浅い部屋ほど速い）`),"ground.collapse.restoreSec":$(8,2,60,`崩れていく帰り道: 全部落ちてから床板が戻るまで（秒。落ちて階段を上るあいだに戻る）`),"ground.domino.trenchM":$(1.9,1.4,2.6,`ドミノの橋: 溝の幅（m。橋の棚の長さ = 幅 + 0.65 が天井に収まること）`),"ground.domino.depthM":$(2.4,1.8,3.05,`ドミノの橋: 溝の深さ（m）`),"ground.domino.heightM":$(1.8,1.2,2.4,`ドミノの橋: 鎖の棚の高さ（m。隣の棚との間 1 m より高く）`),"ground.crate.cellM":$(1.2,1.2,1.5,`箱の橋: 升目の大きさ（m。溝は 2 升の幅。下がり天井の下で、しゃがんで跳んでも 2.4 m は越えられない）`),"ground.crate.heightM":$(.9,.6,1.2,`箱の橋: 箱の高さ（m。溝の深さ = 高さ + 5 cm。落ちた箱の上面が床の高さ）`),"ground.crate.soffitM":$(1.8,1.74,1.9,`箱の橋: 溝の上の下がり天井の高さ（m。走って跳んでも頭が当たって溝を越えられない）`),"ground.crate.minPush":$(4,1,20,`箱の橋: 解くのに要る押す回数の下限`,!0),"ground.crate.maxPush":$(14,2,40,`箱の橋: 解くのに要る押す回数の上限`,!0),"ground.weight.trenchM":$(2.4,2.4,3.2,`重りの床: 溝の幅（m。下がり天井の下で、跳んでも 2.4 m は越えられない）`),"ground.weight.depthM":$(1.8,1.2,3,`重りの床: 溝の深さ（m）`),"ground.weight.soffitM":$(1.8,1.74,1.9,`重りの床: 溝の上の下がり天井の高さ（m）`),"ground.weight.holdSec":$(.8,.2,4,`重りの床: 印から降りてから床板が沈み始めるまで（秒。走れば渡れ、歩くと沈む）`),"ground.weight.speed":$(1.6,.5,4,`重りの床: 床板の上下の速さ（m/s）`),"ground.weight.buttonSec":$(6,2,20,`重りの床: 向こう岸のボタンで床板が上がっている秒数`),"ground.still.trenchM":$(2.4,2.4,3.2,`立ち止まると見える道: 溝の幅（m）`),"ground.still.depthM":$(2.2,1.6,3,`立ち止まると見える道: 溝の深さ（m）`),"ground.still.soffitM":$(1.8,1.74,1.9,`立ち止まると見える道: 溝の上の下がり天井の高さ（m）`),"ground.still.firstSec":$(1.5,.5,5,`立ち止まると見える道: 光の四角で止まって 1 本目の橋が現れるまで（秒）`),"ground.still.secondSec":$(6,3,20,`立ち止まると見える道: さらに長く止まって 2 本目の橋が現れるまで（秒。止まり始めてから）`),"ground.sink.depthM":$(3,2,6,`沈む床: 縦穴の深さ（m）`),"ground.sink.speed":$(.35,.1,1.5,`沈む床: 沈む・戻る速さ（m/s。ゆっくり）`),"ground.sink.gotoSec":$(1.2,.2,5,`沈む床: 底で止まっていて、1 つ下のフロアへ移るまで（秒）`),"ground.rise.maxM":$(2,1.3,3,`せり上がる床: 高い扉の高さの上限（m。天井の高さ − 2.25 m まで）`),"ground.rise.speed":$(.45,.1,1.5,`せり上がる床: 上下の速さ（m/s）`),"ground.balance.holdSec":$(2,.5,8,`天秤の床: 釣り合ってから間の床が下がり始めるまで（秒）`),"ground.hatch.depthM":$(2.4,1.8,3.05,`床下の明かり: 地下の小部屋の深さ（m）`),"ground.chime.tileM":$(1.1,.8,1.6,`踏むと鳴る床: 升目の大きさ（m）`),"ground.chime.length":$(4,3,8,`踏むと鳴る床: 節の長さ（升目の数）`,!0),"ground.chime.demoSec":$(5,2,20,`踏むと鳴る床: 節を見せたあと、次に見せるまでの間（秒）`),"ground.avoid.tileM":$(1,.8,1.6,`踏まない区画: 升目の大きさ（m）`),"ground.avoid.decoy":$(.12,0,.6,`踏まない区画: 道の外の升目のうち、白い（踏んでよい）おとりの割合`),"ground.visit.stopSec":$(.6,.2,3,`順番の区画: 印の上で立ち止まって「訪れた」になるまで（秒）`),"ground.glow.fadeSec":$(30,5,120,`光る床: 踏んだ所が光って消えるまで（秒）`),"ground.trail.stopSec":$(1.5,.5,6,`足跡: 足跡の終わりで立ち止まって扉が現れるまで（秒）`),"ground.loop.corridorM":$(1.5,1.2,2.5,`足跡が残る床: 真ん中の塊のまわりの通路の幅（m）`),"ground.loop.prints":$(320,40,800,`足跡が残る床: 残る足跡の数の上限（古い物から消える）`,!0),"ground.mirror.gazeSec":$(1.2,.3,5,`水たまりの鏡: 水面に映った扉を見続けて、本当の扉が現れるまで（秒）`),"ground.press.bandM":$(1.2,.8,2,`落ちてくる天井: 落ちる天井の帯の奥行き（m）`),"ground.press.stripeM":$(1,.9,2,`落ちてくる天井: 帯と帯の間の、落ちてこない床の幅（m。黄色の線の間）`),"ground.press.upSec":$(2.6,1.6,8,`落ちてくる天井: 上がっている間（秒）`),"ground.press.warnSec":$(1,.5,3,`落ちてくる天井: 影と粉で予告する間（秒）`),"ground.press.fallSec":$(.25,.1,1,`落ちてくる天井: 落ち切るまで（秒）`),"ground.press.holdSec":$(.9,.3,3,`落ちてくる天井: 下りている間（秒）`),"ground.press.riseSec":$(1.4,.5,4,`落ちてくる天井: 上がり切るまで（秒）`),"ground.press.safeSec":$(1.2,.8,3,`落ちてくる天井: 歩く人が渡り始める、落ちてくるまでの残りの秒（予告の前）`),"ground.turn.depthM":$(2,1.6,3.05,`回る円盤: 穴の深さ（m）`),"ground.turn.pauseSec":$(4.5,2.5,10,`回る円盤: 橋が止まっている間（秒）`),"ground.turn.turnSec":$(5,2,12,`回る円盤: 橋が 90° 回るのに掛かる秒`),"ground.turn.needSec":$(2.6,1.5,5,`回る円盤: 歩く人が乗り降りを始める、止まっている残りの秒`),"ground.slide.tileM":$(1.2,1,1.8,`動く床タイル: 床板の升目の大きさ（m）`),"ground.slide.depthM":$(2.4,1.8,3.05,`動く床タイル: 床板の下の溝の深さ（m）`),"ground.slide.holes":$(.22,.1,.4,`動く床タイル: 空いた升目の割合`),"ground.slide.moveSec":$(1.2,.5,4,`動く床タイル: 床板が隣の升目へ滑るのに掛かる秒`),"ground.slide.pauseSec":$(.5,0,4,`動く床タイル: 滑り終えてから次の床板が滑り出すまで（秒）`),"ground.vend.keyAfter":$(5,3,12,`自販機: 同じボタンを続けて何回押すと鍵が出てくるか`,!0),"ground.auto.flaky":$(.4,0,.9,`自動扉: 調子の悪い扉が、近づいても開かない割合`),"ground.auto.crouchSec":$(1.2,.3,4,`自動扉: 故障中の扉の前でしゃがんで、開くまで（秒）`),"ground.shutter.openSec":$(3.5,1.5,10,`シャッター: 開いている間（秒）`),"ground.shutter.downSec":$(3.5,1,10,`シャッター: 下り切るまで（秒）`),"ground.shutter.closedSec":$(1.5,0,6,`シャッター: 閉まっている間（秒）`),"ground.shutter.upSec":$(2.5,1,8,`シャッター: 上がり切るまで（秒）`),"ground.shutter.needSec":$(1.6,.8,4,`シャッター: 歩く人がくぐり始める、開いている残りの秒`),"ground.alarm.sec":$(15,6,40,`回転灯と警報: 警報が鳴っている間（秒。鋼鉄の扉が開いている間）`),"ground.bell.delaySec":$(1.5,.3,5,`呼び出しボタン: 押してから遠くでベルが鳴り始めるまで（秒）`)},sa={"sense.lightPit.depthM":$(2.4,2,3,`光の床の部屋: 穴の深さ（m）`),"sense.beamFloor.tileM":$(.6,.4,1.2,`照らした所だけある床: 床板の大きさ（m）`),"sense.beamFloor.graceSec":$(1.4,.3,4,`照らした所だけある床: 照らすのをやめてから床板が消えるまで（秒。歩いて足元まで来る間はある）`),"sense.beamFloor.deg":$(26,10,40,`照らした所だけある床: 床を作る光の円錐の半角（度。懐中電灯の明るい芯の大きさ）`),"sense.beamFloor.rangeM":$(8,3,20,`照らした所だけある床: 床を作る光の届く距離（m）`),"sense.spotRide.radiusM":$(1.05,.7,2,`動く光の中だけ床: 光の円の半径（m）`),"sense.spotRide.speed":$(.85,.3,2.5,`動く光の中だけ床: 光の円の速さ（m/s。歩くより遅い）`),"sense.spotRide.pauseSec":$(2.5,.5,8,`動く光の中だけ床: 両端で止まる秒数（乗り降りする間）`),"sense.spotRide.tileM":$(.5,.3,1,`動く光の中だけ床: 床板の大きさ（m）`),"sense.lightBands.widthM":$(.75,.5,1.4,`光の帯の橋: 帯の幅（m）`),"sense.lightBands.gapM":$(.45,.2,1.2,`光の帯の橋: 帯の間（m。隣の帯へ乗り移れる）`),"sense.lightBands.onSec":$(4.5,2,12,`光の帯の橋: 帯が点いている秒数（長い穴では、歩いて渡り切れる長さまで延ばす）`),"sense.lightBands.offSec":$(2.5,.5,8,`光の帯の橋: 帯が消えている秒数`),"sense.lightBands.warnSec":$(1,0,3,`光の帯の橋: 消える前に瞬く秒数`),"sense.lookBridge.widthM":$(1,.6,1.6,`見ている間だけある橋: 橋の幅（m）`),"sense.lookBridge.graceSec":$(.9,.2,3,`見ている間だけある橋: 目を離してから橋の板が消えるまで（秒）`),"sense.blinkout.onSec":$(5.5,2,15,`消える照明: 照明が点いている秒数`),"sense.blinkout.offSec":$(3,1,10,`消える照明: 照明が消えている秒数`),"sense.blinkout.flickerSec":$(.9,0,3,`消える照明: 消える前に瞬く秒数（合図）`),"sense.blinkout.graceSec":$(1.3,.5,5,`消える照明: 暗闇にこれだけいると闇に捕まる（秒）`),"sense.blinkout.poolM":$(1.1,.7,2,`消える照明: 消えない灯りの島の半径（m）`),"sense.blinkout.spacingM":$(4.2,2.5,8,`消える照明: 消えない灯りの島の間隔（道に沿って m）`),"sense.lightWave.segmentM":$(2,1,4,`明滅の位相: 照明の区間の長さ（m）`),"sense.lightWave.speed":$(1.5,.6,2.6,`明滅の位相: 光の波の速さ（m/s。歩くより遅い）`),"sense.lightWave.windowM":$(3.2,2,6,`明滅の位相: 点いている帯の長さ（m）`),"sense.lightWave.restSec":$(3,0,10,`明滅の位相: 波と波の間の、全部消えている秒数`),"sense.lightWave.graceSec":$(1,.4,4,`明滅の位相: 暗闇にこれだけいると闇に捕まる（秒）`),"sense.lightWave.doorPoolM":$(1.3,.8,2,`明滅の位相: 開口の前の消えない灯りの半径（m）`),"sense.search.stripM":$(1.6,1.2,3,`サーチライト: 入口・出口の壁沿いの安全な床の奥行き（m）`),"sense.search.laneM":$(1.8,1.2,3,`サーチライト: 光の円が往復する帯の幅（m）`),"sense.search.safeM":$(1.4,1,3,`サーチライト: 帯と帯の間の安全な床の最小の幅（m）`),"sense.search.radiusM":$(.9,.5,1.6,`サーチライト: 光の円の半径（m）`),"sense.search.speedMin":$(1.6,.5,5,`サーチライト: 光の円の速さの下限（m/s）`),"sense.search.speedMax":$(2.6,.5,6,`サーチライト: 光の円の速さの上限（m/s）`),"sense.search.catchesToCorner":$(2,1,10,`サーチライト: これだけ見つかると、戻される先が隅（隠しの扉の前）になる`,!0),"sense.curtains.spacingM":$(1.5,1.2,2.5,`幕の部屋: 幕の口の間隔（m）`),"sense.daruma.chantMin":$(2.4,1,8,`だるまさん: 数え歌の長さの下限（秒）`),"sense.daruma.chantMax":$(5,1,10,`だるまさん: 数え歌の長さの上限（秒）`),"sense.daruma.watchMin":$(1.8,.5,6,`だるまさん: 振り返って見ている長さの下限（秒）`),"sense.daruma.watchMax":$(3.2,.5,8,`だるまさん: 振り返って見ている長さの上限（秒）`),"sense.daruma.tolM":$(.15,.05,.6,`だるまさん: 見られている間に動いてよい距離（m。止まりきれない分）`),"sense.daruma.catchesToCorner":$(3,1,10,`だるまさん: これだけ捕まると、入口ではなく隅（隠しの扉の前）へ連れて行かれる`,!0),"sense.clock.cycleSec":$(30,10,120,`見ていない間だけ進む時計: 見ていない間に針が 12 時間回る秒数`),"sense.clock.windowH":$(.35,.1,1.5,`見ていない間だけ進む時計: 12 時の前後この時間（時）の間に見ると、扉の鍵が開く`),"sense.clock.openSec":$(6,2,20,`見ていない間だけ進む時計: 鍵が開いている秒数`),"sense.clock.goneSec":$(45,10,180,`見ていない間だけ進む時計（BO03）: 一度も見ないまま部屋にこれだけいると、時計が消えて跡が扉になる`),"sense.zoom.sec":$(1.5,.5,5,`ズームで注視: 立ち止まって看板を見つめ続ける秒数（撮像がズームして小さな文字が読める）`),"sense.zoom.deg":$(4,1.5,10,`ズームで注視: 看板を見つめている判定の角度（度）`),"sense.gaze.sec":$(1.6,.5,5,`マネキンの視線の先・鏡の扉など: 見つめ続ける秒数`),"sense.lookBack.sec":$(1,.3,4,`出口の前で振り返る: 来た道を見ている秒数`),"sense.cctv.watchSec":$(2,.5,6,`監視カメラ: モニターを見つめる秒数（自分のいない所の扉が開いているのを見る）`),"sense.chime.intervalSec":$(.7,.3,2,`音をつなぐ扉: 旋律の音と音の間（秒）`),"sense.chime.periodSec":$(11,5,40,`音をつなぐ扉: 旋律をくり返す間隔（秒）`),"sense.gate.loudLevel":$(.55,.2,.95,`マイクで開く扉: 開く音量（0..1。走る 0.7・跳んで着地 1.0・歩く 0.35）`),"sense.gate.quietLevel":$(.08,.01,.3,`静かにすると開く: これより静かな間を数える（0..1）`),"sense.gate.quietSec":$(3,1,10,`静かにすると開く: 静かにしている秒数`),"sense.steps.sneakSec":$(3,1,10,`足音が増える（BA02）: しゃがんで歩き続ける秒数`),"sense.pa.periodSec":$(6,3,20,`遠くの館内放送: 放送をくり返す間隔（秒）`),"sense.living.leanSec":$(4,1.5,12,`壁の向こうの生活音（BA04）: 壁にもたれて止まる秒数`),"sense.silent.sec":$(3,1,10,`無音の隅（BA01）: 無音の隅で止まる秒数`),"sense.maze.cellM":$(1.8,1.6,2.4,`音で形を知る迷路: 迷路の 1 マス（m）`),"sense.maze.dripSec":$(2.2,.8,6,`反響で形が分かる: 出口の前の水の音の間隔（秒）`),"sense.pitch.fogNear":$(0,0,2,`音の高さの部屋: 霧の掛かり始め（m）`),"sense.pitch.fogFar":$(7,1.5,12,`音の高さの部屋: 何も見えなくなる距離（m）`),"sense.mirror.beamY":$(1.05,.6,1.6,`鏡で光を導く: 光の筋の高さ（床から m。腰の高さ）`),"sense.mirror.targetSec":$(1,.3,4,`鏡で光を導く（BL03）: 何も無い壁の印に光を当て続ける秒数`),"sense.power.minSec":$(7,4,20,`非常電源: 電源が持つ秒数の下限`),"sense.power.maxSec":$(14,6,30,`非常電源: 電源が持つ秒数の上限`),"sense.power.walkFactor":$(1.25,.8,2.5,`非常電源: 電源が持つ秒数 = レバーから出口までを歩く秒数 × これ + 2 秒（走れば余裕・歩くと際どい）`),"sense.beacon.depthM":$(2.4,1.6,4,`霧の誘導灯: 穴の深さ（m）`),"sense.beacon.walkM":$(1.15,.9,1.6,`霧の誘導灯: 穴の上の細い道の幅（m）`),"sense.beacon.spacingM":$(2.2,1.2,4,`霧の誘導灯: 誘導灯の間隔（m）`),"sense.beacon.fogNear":$(0,0,2,`霧の誘導灯: 霧の掛かり始め（m）`),"sense.beacon.fogFar":$(8,1.5,12,`霧の誘導灯: 何も見えなくなる距離（m）`),"sense.switch.darkSec":$(1,.2,4,`照明を消すと現れる扉: 照明を消してから扉が現れるまで（秒）`),"sense.sneak.speed":$(2,1.2,2.9,`人感センサーの灯りをつけずに進む: この速さ（m/s）より速く動くと灯りがつく（しゃがみ歩き 1.5・歩き 3.0）`),"sense.sneak.holdSec":$(5,1,15,`人感センサーの灯りをつけずに進む: ついた灯りが消えるまで（秒）`),"sense.rgb.sec":$(4,1.5,12,`色の照明: 赤・緑・青の照明が 1 色ずつ点いている秒数`),"sense.lightning.minSec":$(4,1.5,20,`雷: 稲光の間隔の下限（秒）`),"sense.lightning.maxSec":$(10,3,40,`雷: 稲光の間隔の上限（秒）`),"sense.shadow.speed":$(1.1,.4,2.5,`影だけ動く: 影の歩く速さ（m/s）`),"sense.late.delaySec":$(.45,.15,1.5,`足音が遅れて聞こえる: 足音と足跡の遅れ（秒）`),"sense.edge.showDeg":$(34,20,50,`視界の端の人影: 視線からこれ以上（度）ずれた所にだけ現れる`),"sense.edge.hideDeg":$(20,8,32,`視界の端の人影: 視線がこれより近づくと消える（度）`),"sense.chairs.max":$(8,3,16,`見ていない間に動く家具: 動く椅子の数の上限`,!0),"sense.slow.speed":$(.5,.2,.9,`遅い部屋: 動く速さの倍率`),"sense.slow.pitch":$(.62,.3,.95,`遅い部屋: 足音の高さの倍率（低く・ゆっくり聞こえる）`),"sense.flood.depthM":$(2.4,2,3.2,`増水: 穴の深さ（m。満ちると頭まで浸かる深さ）`),"sense.flood.lowSec":$(5,2,20,`増水: 水が引いている秒数`),"sense.flood.riseSec":$(7,2,20,`増水: 満ちていく秒数`),"sense.flood.highSec":$(7,3,20,`増水: 満ちている秒数（浮いた箱を渡る間）`),"sense.flood.drainSec":$(5,2,20,`増水: 引いていく秒数`),"sense.flood.drownSec":$(1.2,.4,4,`増水: 頭まで浸かってから入口へ戻されるまで（秒。泳げない）`),"sense.rewind.minSec":$(12,6,30,`巻き戻る部屋: 巻き戻る間隔の下限（秒）`),"sense.rewind.maxSec":$(28,10,60,`巻き戻る部屋: 巻き戻る間隔の上限（秒）`),"sense.rewind.factor":$(1.6,1.1,3,`巻き戻る部屋: 間隔 = 入口 → レバー → 出口を歩く秒数 × これ`),"sense.loop.sec":$(40,20,90,`同じ 1 分のくり返し: くり返しの長さ（秒）`),"sense.loop.ringFrom":$(8,0,60,`同じ 1 分のくり返し: 電話が鳴り始める秒`),"sense.loop.ringTo":$(17,1,60,`同じ 1 分のくり返し: 電話が鳴りやむ秒`),"sense.loop.openFrom":$(27,0,80,`同じ 1 分のくり返し: 出口の鍵が開く秒`),"sense.loop.openTo":$(36,1,85,`同じ 1 分のくり返し: 出口の鍵が閉まる秒（くり返しの終わりより前）`),"sense.closing.delaySec":$(3.5,1,10,`閉店のアナウンス: 放送から照明が消え始めるまで（秒）`),"sense.closing.speed":$(2.2,1,3,`閉店のアナウンス: 照明が消えていく速さ（m/s。歩き 3.0 より遅い）`),"sense.closing.segmentM":$(2,1,4,`閉店のアナウンス: 照明の区間の長さ（m）`),"sense.closing.graceSec":$(1,.3,3,`閉店のアナウンス: 暗闇にこれだけいると捕まって入口へ（秒）`)},ca={"anomaly.w.smoke":$(.7,0,10,`煙の層（E02）`),"anomaly.w.leak":$(.85,0,10,`雨漏り（E03）`),"anomaly.w.snow":$(.75,0,10,`雪の室内（E04）`),"anomaly.w.wind":$(.85,0,10,`風の向き（E08）`),"anomaly.w.thermal":$(.95,0,10,`温度（E07）`),"anomaly.w.meadow":$(.7,0,10,`草原・ひまわり畑（E05）`),"anomaly.w.overgrowth":$(.75,0,10,`植物に覆われる（E12）`),"anomaly.w.sand":$(.6,0,10,`砂の部屋（E11）`),"anomaly.w.sea":$(.9,0,10,`室内の海（E10）`),"anomaly.w.waterWall":$(.75,0,10,`水の壁（E09）`),"anomaly.w.miscount":$(.75,0,10,`数が合わない（X03）`),"anomaly.w.fakeSigns":$(1.3,0,10,`案内の嘘（X04）`),"anomaly.w.nameplate":$(.65,0,10,`自分の名前（X05）`),"anomaly.w.exitSign":$(.7,0,10,`正しい出口の印（X13）`),"anomaly.w.missingColor":$(.75,0,10,`色が抜ける（X07）`),"anomaly.w.mono":$(.5,0,10,`単色の部屋（X08。黒一色・1 色だけ）`),"anomaly.w.huddle":$(.7,0,10,`家具が一か所に集まる（X10）`),"anomaly.w.oddScale":$(.95,0,10,`回転と大きさ（X11）`),"anomaly.w.misplaced":$(.8,0,10,`別の部屋の家具（X12）`),"anomaly.w.carryover":$(.65,0,10,`前の部屋の物（X06）`),"anomaly.w.void":$(.75,0,10,`壁と床が欠ける（X09）`),"anomaly.w.vast":$(.65,0,10,`中が広い部屋（W04・W09・W18）`),"anomaly.w.mirror":$(1.1,0,10,`鏡の部屋（W16）`),"anomaly.w.sideways":$(.75,0,10,`横倒しの部屋（W17）`),"anomaly.w.perspective":$(.8,0,10,`遠近法の錯覚（W15）`),"anomaly.w.dayCycle":$(.6,0,10,`時刻が進む部屋（T02）`),"anomaly.w.aging":$(.8,0,10,`古くなる部屋（T08）`),"anomaly.w.justLeft":$(.65,0,10,`去った人の残り（T09）`),"anomaly.smoke.bottomMin":$(1.15,.9,1.5,`煙の層: 煙の底の高さの下限（床から m。しゃがんだ目 0.75 m より上・立った目 1.6 m より下）`),"anomaly.smoke.bottomMax":$(1.3,.9,1.5,`煙の層: 煙の底の高さの上限（床から m）`),"anomaly.smoke.far":$(5.5,.5,12,`煙の層: 目が煙の中にあるときに何も見えなくなる距離（m。近くはなんとか見える。しゃがむと煙の下がよく見える）`),"anomaly.leak.dripsMax":$(10,1,30,`雨漏り: 雨染みと水たまりの数の上限`,!0),"anomaly.leak.dropsMax":$(500,50,2e3,`雨漏り: 雨の筋の数の上限（描画の粒）`,!0),"anomaly.leak.slow":$(.9,.5,1,`雨漏り: 水たまりの中の歩く速さの倍率`),"anomaly.snow.depth":$(.05,.01,.15,`雪の室内: 床の雪の厚さ（m。当たらない。足が少し埋まって見える）`),"anomaly.snow.prints":$(180,20,600,`雪の室内: 残す足跡の数の上限（古い物から消える）`,!0),"anomaly.snow.flakesMax":$(450,50,2e3,`雪の室内: 降る雪の粒の数の上限（描画）`,!0),"anomaly.snow.fogFar":$(16,6,40,`雪の室内: 部屋の白い霞の見える距離（m）`),"anomaly.wind.push":$(.6,0,2.5,`風の向き: 体を押す風の強さ（m/s。歩く速さ 3.0 より十分弱く）`),"anomaly.wind.itemsMax":$(90,10,300,`風の向き: 流れる紙・葉の数の上限（描画）`,!0),"anomaly.thermal.fogFar":$(9,2,16,`温度: 冷たい霧の見える距離（m。先の開口は入口から見えない）`),"anomaly.thermal.frost":$(.85,0,1,`温度: いちばん寒い所の画面の霜の強さ`),"anomaly.meadow.sunflower":$(1,0,10,`草原: ひまわり畑（全部が入口を向く）の重み`),"anomaly.meadow.wheat":$(.8,0,10,`草原: 麦畑の重み`),"anomaly.meadow.flowers":$(.8,0,10,`草原: 野の花の重み`),"anomaly.meadow.boxesMax":$(700,100,1400,`草原: 草木の箱の数の上限（描画の量）`,!0),"anomaly.overgrowth.boxesMax":$(600,100,1400,`植物に覆われる: 草木の箱の数の上限`,!0),"anomaly.sand.slow":$(.85,.5,1,`砂の部屋: 砂の上の歩く速さの倍率`),"anomaly.sand.shift":$(.025,0,.2,`砂の部屋: 床の風紋が流れる速さ（m/s。描画）`),"anomaly.sea.depth":$(.5,.2,.7,`室内の海: 海の深さ（m）`),"anomaly.sea.slow":$(.5,.2,1,`室内の海: 海の中の歩く速さの倍率`),"anomaly.sea.push":$(1.1,0,2.5,`室内の海: 寄せる波が浜へ押し戻す強さ（m/s。海の中を歩く速さ 1.5 より弱く）`),"anomaly.sea.period":$(6.5,3,15,`室内の海: 波の周期（秒）`),"anomaly.mono.black":$(.5,0,1,`単色の部屋: 黒一色にする割合（残りは 1 色だけの部屋）`),"anomaly.oddScale.spin":$(.35,0,3,`回転と大きさ: 宙で回る家具の回る速さ（rad/s。描画）`),"anomaly.oddScale.giantMin":$(2.2,1.5,4,`回転と大きさ: 巨大な家具の倍率の下限`),"anomaly.oddScale.giantMax":$(2.8,1.5,4,`回転と大きさ: 巨大な家具の倍率の上限`),"anomaly.carryover.items":$(4,1,10,`前の部屋の物: 写す家具の数の上限（大きい順）`,!0),"anomaly.void.depth":$(2.8,1.5,3.05,`壁と床が欠ける: 虚空の穴の深さ（m。3.1 m 以上は隣の区画の下に入り込む）`),"anomaly.vast.heightMin":$(9,6,20,`中が広い部屋: 天井の高さの下限（m。部屋の上の空きが足りなければ低くする）`),"anomaly.vast.heightMax":$(14,6,20,`中が広い部屋: 天井の高さの上限（m）`),"anomaly.vast.pillarSpacing":$(4.5,2.5,10,`中が広い部屋: 太い柱の間隔の目安（m）`),"anomaly.vast.narrow":$(.5,0,1,`中が広い部屋: 入口のすぐ内側を狭く低い通り口にする割合（W09）`),"anomaly.vast.mapScale":$(.55,.2,1,`中が広い部屋: 地図に出す見かけの大きさ（主の矩形の辺の倍率。W18）`),"anomaly.perspective.bands":$(5,3,8,`遠近法の錯覚: 奥行きを分ける帯の数`,!0),"anomaly.perspective.minScale":$(.45,.2,.9,`遠近法の錯覚: いちばん奥の家具・照明の大きさの倍率`),"anomaly.perspective.ceilMin":$(2.25,2.21,3,`遠近法の錯覚: いちばん奥の天井の高さ（m。開口の前の空ける高さ 2.2 m より上）`),"anomaly.perspective.doorFar":$(.5,.2,1,`遠近法の錯覚: 奥の扉の、遠くから見た大きさの倍率`),"anomaly.dayCycle.daySec":$(90,20,600,`時刻が進む部屋: 部屋の中で朝から次の朝までの秒数（部屋にいる間だけ進む）`),"anomaly.justLeft.chairSpin":$(.7,0,4,`去った人の残り: まだ回っている椅子の回る速さ（rad/s。描画）`),"anomaly.oneDifferent.depthM":$(2.3,2,3.2,`一つだけ違う: ブースの奥行き（m）`),"anomaly.oneDifferent.boothM":$(2.2,2.1,3.2,`一つだけ違う: ブースの幅の目安（m。壁の長さをこの幅で割って 3〜5 つ）`)},la={"carry.item.range":$(2.6,1.2,4,`持てる物: 調べて（E / タップ）拾える距離（m）`),"carry.item.dropM":$(.8,.4,1.5,`持てる物: Q で置く所（体の前 m）`),"carry.item.placeTopM":$(1.25,.6,2,`持てる物: Q で上に置ける台の高さの上限（足元から m。机・棚の上）`),"carry.item.slotAimM":$(2.8,1,5,`持てる物: 置き台・受けの枠を視線で狙える距離（m）`),"carry.item.throwSpeed":$(7.5,2,16,`持てる物: 投げる速さ（m/s。走っている速さを足す）`),"carry.item.throwPitch":$(.3,0,1.2,`持てる物: この角度（rad）より上を向いて Q なら投げる（走っていても投げる）`),"carry.item.runPitch":$(.18,0,.8,`持てる物: 走りながら投げるときの、いちばん低い投げ上げの角度（rad）`),"carry.item.gravity":$(9.8,1,20,`持てる物（物理を使わない物）: 投げた物に掛かる重さ（m/s²）`),"carry.item.flySec":$(8,1,30,`持てる物: 投げた物が止まらないとき、元の所へ戻すまでの秒数`),"carry.water.safeSpeed":$(1.9,.8,3.5,`水を運ぶ: この速さ（m/s）より速く歩くとこぼれる（しゃがみ歩き 1.5・歩き 3.0・走り 5.5）`),"carry.water.spillRate":$(.12,.05,2,`水を運ぶ: 速さの超えた分 1 m/s あたり、1 秒にこぼれる割合`),"carry.water.jumpSpill":$(.22,0,1,`水を運ぶ: 跳んで着地したときにこぼれる割合`),"carry.water.fillSec":$(1.2,.2,5,`水を運ぶ: 蛇口の下で満杯になるまでの秒数`),"carry.parcel.waitSec":$(2.5,.5,10,`荷物と待つ扉: 荷物を持って枠の中で待つ秒数`),"carry.hatch.depthM":$(2.4,2.2,3,`床下収納: 穴の深さ（m。底の壁に高さ 2 m の扉が入る）`),"carry.weight.need":$(3,1,10,`重さで開く: 板の上に要る重さ（重い木箱 1 つ = これ。軽い箱 2 つで足りる）`),"carry.weight.plateM":$(3.5,2,8,`重さで開く: 板と蓋の間の距離の下限（m。板から降りて走っても間に合わない）`),"carry.weight.closeSec":$(.6,.1,3,`重さで開く: 重さが無くなってから蓋が閉まり始めるまでの秒数`),"carry.replica.pitchM":$(.7,.4,1.5,`物を置くと増える: 並べる間隔（m）`),"carry.replica.max":$(64,8,200,`物を置くと増える: 並べる数の上限`,!0),"carry.home.stageM":$(12,3,60,`運ぶと変わる物: この道のり（m）を運ぶごとに次の形になる（4 段。最後は鍵）`),"carry.balance.min":$(4,1,10,`天秤: 釣り合わせる片側の重さの下限（軽い箱 1 つずつでは開かない）`),"carry.pinball.push":$(1.2,.3,2.8,`ピンボール: 床が手前へ押す速さ（m/s。歩き 3.0 より遅いので逆らって歩ける）`),"carry.pinball.friction":$(.45,.05,1,`ピンボール: 床の滑りやすさ（小さいほど滑る）`),"carry.pinball.kick":$(6.5,2,12,`ピンボール: 丸い柱が弾く速さ（m/s）`),"carry.cart.speed":$(1.4,.5,4,`カートの坂: 台車の速さ（m/s）`),"carry.cart.laps":$(3,1,10,`カートの坂: 降りずに乗り続けると隠しが現れる周の数`,!0),"carry.memory.showSec":$(10,3,30,`記憶の部屋: 照明が消えるまで見せる秒数`),"carry.memory.patientSec":$(20,5,90,`記憶の部屋: 暗い間に物に触れずにじっとしていると隠しが現れる秒数`),"carry.book.pickR":$(.45,.2,1,`本を集める: 本を拾う半径（体の中心から水平に m）`),"carry.book.routeClear":$(.45,.2,1.2,`本を集める: 1 冊も拾わずに返却台へ行く道から、本を離す余裕（拾う半径に足す m）`)},ua={"warp.loopHall.weight":$(.5,0,10,`閉じた輪の廊下: 出やすさ（相対）`),"warp.loopHall.periodM":$(12,6,24,`閉じた輪の廊下: 同じ物が並ぶ長さ = 戻される長さ（m。6 の倍数）`,!0),"warp.loopHall.periods":$(3,3,6,`閉じた輪の廊下: くり返しの数（霧の届く長さの 2 倍 + 1 周より長く）`,!0),"warp.loopHall.fogFarM":$(10,6,14,`閉じた輪の廊下: 霧で何も見えなくなる距離（m）`),"warp.loopHall.widthM":$(2.4,1.8,3.2,`閉じた輪の廊下: 廊下の幅（壁を含む）`),"warp.loopHall.heightM":$(2.7,2.4,3.2,`閉じた輪の廊下: 天井の高さ`),"warp.loopHall.lapsOut":$(4,1,12,`閉じた輪の廊下: 前へ何周すると輪がほどけて奥の扉へ進めるか`,!0),"warp.loopHall.lapsBack":$(3,1,12,`閉じた輪の廊下（BX02）: 輪が閉じたあと、後ろへ何周すると後ろの輪がほどけて隠しの入口が現れるか`,!0),"warp.loopHall.giveUpSec":$(80,20,600,`閉じた輪の廊下: 抜けられなくてもこの秒数で前も後ろもほどける（閉じ込めない）`),"warp.loopHall.secretWeight":$(1.4,0,5,`閉じた輪の廊下（BX02）: 隠しの元の重み`),"warp.lapHall.weight":$(.6,0,10,`異変の廊下: 出やすさ（相対）`),"warp.lapHall.goal":$(5,1,12,`異変の廊下: 何回続けて正しく進む・引き返すと出口の周になるか`,!0),"warp.lapHall.chance":$(.55,0,1,`異変の廊下: 周に異変がある確率（間違えた次の周と最初の周は異変なし）`),"warp.lapHall.secretRun":$(3,1,8,`異変の廊下（BX01）: 一度も引き返さずに、異変のある周を何回進むと、異変の部屋の扉が現れるか`,!0),"warp.lapHall.secretWeight":$(1.6,0,5,`異変の廊下（BX01）: 隠しの元の重み`),"warp.stairs.weight":$(.45,0,10,`階段の数: 出やすさ（相対）`),"warp.stairs.goal":$(6,1,20,`階段の数: 何階上ると、同じ踊り場から抜けて上の階へ出られるか`,!0),"warp.stairs.giveUpSec":$(150,30,900,`階段の数: 階段室に入ってからこの秒数で、上の階へ必ず抜けられる`),"warp.recede.weight":$(.45,0,10,`遠ざかる廊下: 出やすさ（相対）`),"warp.recede.periods":$(4,2,8,`遠ざかる廊下: 廊下の長さ（12 m のくり返しの数）`,!0),"warp.recede.startM":$(9,4,20,`遠ざかる廊下: 扉を開けたときに見える突き当たりまでの距離（m）`),"warp.recede.rate":$(.5,0,3,`遠ざかる廊下: 1 m 歩くごとに残りの距離が伸びる量（m。v1 E13 と同じ 0.5）`),"warp.recede.widthM":$(2.4,1.8,3.2,`遠ざかる廊下: 廊下の幅（壁を含む）`),"warp.recede.heightM":$(2.7,2.4,3.2,`遠ざかる廊下: 天井の高さ`),"warp.lookBack.weight":$(.6,0,10,`振り返ると変わる: 出やすさ（相対）`),"warp.lookBack.booths":$(6,3,8,`振り返ると変わる: 壁沿いの小部屋の数（多くて）`,!0),"warp.lookBack.unseenSec":$(.6,.1,5,`振り返ると変わる: 小部屋から目を離してこの秒数で別の場面に変わる`),"warp.fourRights.weight":$(.5,0,10,`4 回曲がっても戻らない: 出やすさ（相対）`),"warp.fourRights.ringM":$(1.5,1.1,2.2,`4 回曲がっても戻らない: 真ん中の塊のまわりの通路の幅（m）`),"warp.fourRights.secretWeight":$(1.5,0,5,`4 回曲がっても戻らない: 隠しの元（1 周回ると現れる扉）の重み`),"warp.cornerSwap.weight":$(.5,0,10,`曲がると変わる景色: 出やすさ（相対）`),"warp.cornerSwap.passageM":$(1.7,1.4,2.4,`曲がると変わる景色: 扉の壁と仕切りの間の通路の幅（m）`),"warp.cornerSwap.gapM":$(1.2,1,1.8,`曲がると変わる景色: 仕切りの端の切れ目の幅（m）`),"warp.cornerSwap.unseenSec":$(.5,.1,5,`曲がると変わる景色: 通路と切れ目が見えなくなってこの秒数で次の部屋に変わる`),"warp.turnRoom.weight":$(.8,0,10,`回転する部屋: 出やすさ（相対。置ける部屋が広い部屋だけなので重め）`),"warp.turnRoom.ringM":$(1.2,1,2,`回転する部屋: 筒の外の通路の幅（m）`),"warp.turnRoom.gapM":$(1.1,.9,1.6,`回転する部屋: 筒の入口の幅（m）`),"warp.turnRoom.periodSec":$(40,15,120,`回転する部屋: 1 回りの秒数`),"warp.turnRoom.secretWeight":$(1.2,0,5,`回転する部屋: 隠しの元（筒を通らないと行けない区切りの壁）の重み`),"warp.turnRoom.drift":$(.12,0,.6,`回転する部屋: 外へ押す強さ（軸から 1 m 離れるごとの m/s）`),"warp.twoDoors.weight":$(.5,0,10,`2 つの扉が同じ部屋へ: 出やすさ（相対）`),"warp.twoDoors.spacingM":$(2.6,2.2,4,`2 つの扉が同じ部屋へ: 並んだ扉の真ん中どうしの間隔（m）`),"warp.twoDoors.depthM":$(4.8,3.6,7,`2 つの扉が同じ部屋へ: 居間の奥行き（扉 A から扉 B まで。m）`),"warp.timedDoors.weight":$(.45,0,10,`時間で入れ替わる扉: 出やすさ（相対）`),"warp.timedDoors.spacingM":$(2,1.8,4,`時間で入れ替わる扉: 並んだ扉の真ん中どうしの間隔（m）`),"warp.timedDoors.periodSec":$(30,8,300,`時間で入れ替わる扉: 2 枚の扉の行き先が入れ替わる間隔（秒）`),"warp.timedDoors.secretWeight":$(1.4,0,5,`時間で入れ替わる扉: 隠しの元（琥珀の部屋の壁）の重み`),"warp.lightFrame.weight":$(.5,0,10,`距離を飛び越える扉: 出やすさ（相対）`),"warp.lightFrame.secretWeight":$(1.5,0,5,`距離を飛び越える扉（BX03）: 隠しの元（枠の裏から入る廊下）の重み`),"warp.pastWindow.weight":$(.5,0,10,`窓の向こうの自分: 出やすさ（相対）`),"warp.pastWindow.delaySec":$(4,1,15,`窓の向こうの自分: 窓の向こうの自分が、何秒前の自分か`),"warp.pastWindow.stillSec":$(18,5,120,`窓の向こうの自分（BX08）: 窓の前で何秒じっとしていると、向こうの自分が壁を叩きに行くか`),"warp.pastWindow.secretWeight":$(1.4,0,5,`窓の向こうの自分（BX08）: 隠しの元（向こうの自分が叩く壁）の重み`),"warp.floorLoop.chance":$(.2,0,1,`前の階に戻る輪: ふつうの出口が前の階（2〜3 階上）へ戻る確率（深さごと。同じ階からは 1 回だけ）`),"warp.floorLoop.minDepth":$(3,2,20,`前の階に戻る輪: この深さより浅い階では戻らない`,!0)},da={"structure.w.chain":$(1,0,10,`くねる部屋の連なり（F03）`),"structure.w.courtyard":$(1,0,10,`中庭を囲む（F05）`),"structure.w.shortcut":$(1,0,10,`二重ループ・奥から開く近道（F06）`),"structure.w.loops":$(1,0,10,`入れ子のループ（F07）`),"structure.w.concentric":$(1,0,10,`同心円（F11）`),"structure.w.spiral":$(1,0,10,`螺旋（F12）`),"structure.w.skip":$(1,0,10,`スキップフロア（F13）`),"structure.w.gallery":$(1,0,10,`中二階（F14）`),"structure.w.crossing":$(1,0,10,`立体交差（F15）`),"structure.w.islands":$(1,0,10,`島と橋（F16）`),"structure.w.nest":$(1,0,10,`入れ子の部屋（F17）`),"structure.w.megahall":$(1,0,10,`巨大空間の中の建物（F18）`),"structure.w.mirror":$(1,0,10,`鏡写し（F19）`),"structure.w.shrink":$(1,0,10,`縮むくり返し（F20）`),"structure.w.staff":$(1,0,10,`表と裏の動線（F21）`),"structure.w.crawl":$(1,0,10,`天井裏の這う網（F22）`),"structure.w.tower":$(1,0,10,`縦に積んだビル（F23）`),"structure.w.elevator":$(1,0,10,`エレベーターホールの中心（F24）`),"structure.w.descent":$(1,0,10,`下るだけのフロア（F29）`),"structure.w.shaft":$(1,0,10,`吹き抜けの縦穴（F31）`),"structure.w.rooftop":$(1,0,10,`屋上（F33）`),"structure.w.arcade":$(1,0,10,`地下街（F34）`),"structure.w.wings":$(1,0,10,`分棟（F02）`),"structure.storyHeightM":$(4.4,4,6,`階の高さ（床から上の階の床まで。m）。上下に重なる区画の間は、天井 + 床板 + 余裕`),"structure.towerStoriesMin":$(2,2,4,`縦に積んだビル・エレベーターホールの階の数（最小）`,!0),"structure.towerStoriesMax":$(3,2,4,`縦に積んだビル・エレベーターホールの階の数（最大）`,!0),"structure.wellDoorChance":$(.8,0,1,`階段室の出入り口を防火扉にする確率（扉でないときは開口）`),"structure.chain.spacingM":$(8.5,7,12,`くねる部屋の連なり・中庭を囲む部屋の区画の間隔（m）。部屋は区画いっぱいで、隣と壁 1 枚でつながる`),"structure.chain.branchChance":$(.25,0,1,`くねる部屋の連なり: 本道の部屋から、行き止まりの部屋へ枝分かれする確率`),"structure.chain.loopChance":$(.12,0,1,`くねる部屋の連なり: 隣り合う部屋どうしに、もう 1 つ扉を足す確率（回り道）`),"structure.railM":$(1.1,1,1.4,`手すり・胸壁の高さ（m）。跳んだ足の高さ（約 0.9 m）より高く、越えられない`),"structure.walkway.widthM":$(2.2,1.6,3.2,`分棟の渡り廊下の幅（m）`),"structure.bridge.widthM":$(1.7,1.4,2.4,`島と橋の橋の幅（m）`),"structure.outdoor.fogNear":$(3,0,20,`屋外（渡り廊下・屋上）の霧の始まり（m）`),"structure.outdoor.fogFar":$(26,8,80,`屋外（渡り廊下・屋上）の霧の果て（m）`),"structure.concentric.innerWidthM":$(1.5,1.2,2.4,`同心円: いちばん内側の輪の廊下の幅（m）`),"structure.concentric.innerLight":$(.35,.05,1,`同心円: いちばん内側の明るさの倍率（外ほど 1 に近い）`),"structure.skip.spacingM":$(13,11,18,`スキップフロア: 区画の間隔（m。半階の階段が収まるように広め）`),"structure.staff.widthM":$(1.4,1.2,2,`表と裏の動線: 従業員用の通路の幅（m）`),"structure.staff.heightM":$(2.3,2.1,2.6,`表と裏の動線: 従業員用の通路の天井の高さ（m）`),"structure.staff.backDoorChance":$(.5,0,1,`表と裏の動線: 客用の部屋に、裏の通路への扉を付ける確率`),"structure.descent.dropM":$(1.6,1.3,3.2,`下るだけのフロア: 1 回の飛び降りの高さ（m。跳んでも上がれない）`),"structure.descent.spacingM":$(12,10,16,`下るだけのフロア: 区画の間隔（m）`),"structure.maze.extraExits":$(2,0,3,`迷路フロア: 出口の階段の数（本来の出口に足す数。それぞれ行き先が違う）`,!0),"structure.linear.narrowWidthM":$(1.25,1.1,2,`緊張と解放: 狭い通路の幅（m）`),"structure.linear.narrowHeightM":$(2.15,2,2.6,`緊張と解放: 狭い通路の天井の高さ（m）`),"structure.linear.wideHeightM":$(6,4,10,`緊張と解放: 広い空間の天井の高さ（m）`),"structure.arcade.widthM":$(4,3.6,5.5,`地下街: 通路の幅の下限（m。真ん中に柱の列が立つ）`),"structure.arcade.heightM":$(2.75,2.4,3.2,`地下街: 通路の天井の高さの上限（m。広くて低い）`),"structure.nest.depth":$(3,2,4,`入れ子の部屋: 部屋の入れ子の数（いちばん外の部屋を含む）`,!0),"structure.megahall.heightM":$(9,6,14,`巨大空間: 天井の高さ（m）`),"structure.building.heightM":$(2.6,2.4,3.2,`巨大空間の中の建物・屋上の小屋の天井の高さ（m）`),"structure.mirror.diffs":$(1,1,3,`鏡写し: 左右で違う所の数`,!0),"structure.mirror.cleanPairs":$(2,0,4,`鏡写し: 仕掛け・異変を置かず、家具まで鏡に写す対の部屋の数（入口に近い順）`,!0),"structure.shrink.ratio":$(.84,.7,.95,`縮むくり返し: くり返すたびに掛ける大きさの倍率`),"structure.shrink.count":$(5,3,7,`縮むくり返し: くり返しの数`,!0),"structure.shrink.minHeightM":$(1.15,1,1.6,`縮むくり返し: 天井の高さの下限（m。しゃがむ高さ 0.85 m より高く）`),"structure.shrink.lastHeightM":$(1.5,1.15,1.65,`縮むくり返し: 最後の部屋の天井の高さの目安（m。立った高さ 1.7 m より低く、しゃがんで進む）`),"structure.crawl.heightM":$(1,.95,1.3,`天井裏の這う網: 這う通路の天井の高さ（m。立てない）`),"structure.crawl.widthM":$(1.2,1,1.6,`天井裏の這う網: 這う通路の幅（m）`),"structure.crawl.hatches":$(3,2,5,`天井裏の這う網: 天井の点検口（上り下りの梯子段）の数`,!0),"structure.gallery.upperRooms":$(3,1,5,`中二階: 中二階から入る上の階の部屋の数`,!0),"structure.shaft.levels":$(3,1,5,`吹き抜けの縦穴: 上と下に見える、ほかの階の回廊の数（それぞれ）`,!0),"structure.spiral.laps":$(3,2,4,`螺旋: 吹き抜けの周りを回る数`,!0),"structure.spiral.voidM":$(7,5,12,`螺旋: 吹き抜けの一辺（m）`),"structure.elevator.rideSec":$(3.5,1,10,`エレベーター: 乗っている時間（秒）`),"structure.elevator.closeSec":$(1.2,.5,4,`エレベーター: 扉が閉まるまで（秒）`),"structure.station.chance":$(.2,0,1,`駅: 駅の続く線が始まる確率（深さ 1・5・9 … の 4 フロアごとの枠ごと。始まると 2〜3 フロア続けて駅）`),"structure.station.dwellSec":$(4,1,20,`駅: 車両に乗ってから扉が閉まるまで（秒）`),"structure.station.rideSec":$(9,3,30,`駅: 次の駅に着くまで（秒）`),"structure.privateRoom.parts":$(3,2,4,`別室: 1 つの部屋に重ねる異変の数`,!0)},fa={"rooms.chance.room":$(.55,0,1,`普通の部屋（仕掛け・異変の無い部屋）に部屋の形を掛ける確率`),"rooms.chance.hall":$(.6,0,1,`普通の広間に部屋の形を掛ける確率`),"rooms.chance.anomaly":$(.3,0,1,`異変の部屋（中身を置く前の段の無い異変）に、重ねてよい形を掛ける確率`),"rooms.openMul":$(.6,0,1,`入口に扉の無い部屋の確率の倍率（扉を開けた瞬間の驚きを優先する）`),"rooms.repeatMul":$(.3,0,1,`同じフロアに同じ形がすでにあるとき、1 つごとに重みに掛ける倍率`),"rooms.buildTries":$(6,1,12,`選んだ形がその部屋に組めないとき、次の候補を試す数（3 では当たった部屋の 1 割ほどが組めずに普通の部屋のままだった）`,!0),"rooms.maxBoxes":$(900,100,4e3,`1 つの形が区画に足す箱の上限（描画の三角形と焼き込みの時間。中身の家具は別に dress の上限）`,!0),"rooms.maxLights":$(18,4,64,`形を掛けた区画の点光源の上限（元の数より多くはしない。スマホの灯りの予算）`,!0),"rooms.w.pillars":$(1.2,0,10,`S01 柱林`),"rooms.w.grandHall":$(3,0,10,`S02 大広間（広間だけ）`),"rooms.w.tallHall":$(.6,0,10,`S03 縦長ホール`),"rooms.w.ceilingWells":$(.9,0,10,`S05 天井井戸`),"rooms.w.lowRoom":$(.7,0,10,`S10 低すぎる天井（形の id は lowRoom。仕掛けの lowCeiling と分ける）`),"rooms.w.highCeiling":$(.6,0,10,`S11 高すぎる天井`),"rooms.w.waveCeiling":$(.8,0,10,`S30 天井の高さが場所で変わる`),"rooms.w.splitHall":$(1,0,10,`S06 分割ホール`),"rooms.w.bentRoom":$(1.2,0,10,`S07 L 字・コの字・ロの字`),"rooms.w.doubleWall":$(.9,0,10,`S13 二重壁`),"rooms.w.halfBasement":$(.8,0,10,`S16 半地下`),"rooms.w.slantWalls":$(.9,0,10,`S17 斜めの壁`),"rooms.w.windows":$(.9,0,10,`S23 窓だらけ`),"rooms.w.hut":$(.8,0,10,`S21 部屋の中の小屋`),"rooms.w.eelBed":$(3,0,10,`S12 うなぎの寝床（長い区画だけ）`),"rooms.w.endless":$(1,0,10,`S26 果てしない通路（表のフロアだけ）`),"rooms.w.roundRoom":$(1.8,0,10,`S18 円形の部屋（開口が区画の中心線の上にあるとき）`),"rooms.w.centerHole":$(1.8,0,10,`S15 中央の穴`),"rooms.w.pitGallery":$(2,0,10,`S04 穴の回廊`),"rooms.w.grating":$(.7,0,10,`S14 全面グレーチングの床`),"rooms.w.sunkenWater":$(.9,0,10,`S28 水没した下半分`),"rooms.w.terraces":$(2.4,0,10,`S08 段々の部屋`),"rooms.w.theater":$(2.4,0,10,`S09 半円の劇場`),"rooms.w.loft":$(1,0,10,`S20 ロフト付き`),"rooms.w.scaffold":$(2,0,10,`S22 足場の部屋`),"rooms.w.layers":$(1.4,0,10,`S27 一つの部屋が何層も`),"rooms.w.stairsOnly":$(1.8,0,10,`S29 階段だけの部屋`),"rooms.w.atticStair":$(.9,0,10,`S19 天井から下がる階段`),"rooms.w.tilted":$(.9,0,10,`S25 傾いた部屋（開口が 1 本の線の上にあるとき）`),"rooms.tilt.deg":$(6,2,12,`傾いた部屋: 傾き（度）`),"rooms.theater.stageD":$(2,1.4,3.5,`半円の劇場: 舞台の奥行き（m）`),"rooms.theater.stageH":$(.7,.35,1,`半円の劇場: 舞台の高さ（m。前の段 2 段で上がる）`),"rooms.hole.rimM":$(1.25,1.1,2.5,`中央の穴: 縁の幅の下限（m。開口のある壁の側は扉の前を空ける広さ）`),"rooms.hole.depthM":$(2.2,1,3,`中央の穴: 穴の深さ（m。落ちたら壁沿いの段で戻る）`),"rooms.gallery.widthM":$(1.3,1.1,2.5,`穴の回廊: 回廊の幅（m）`),"rooms.gallery.depthM":$(2.6,2,3.05,`穴の回廊: 吹き抜けの深さ（m。下の部屋の高さ。3.1 m 以上は隣の区画の下に入り込みやすい）`),"rooms.grating.depthM":$(2.4,1.2,3.05,`全面グレーチング: 格子の下の空間の深さ（m）`),"rooms.grating.pitchM":$(.12,.06,.4,`全面グレーチング: 格子の棒の間隔（m）`),"rooms.sunken.depthM":$(1.4,.8,2.2,`水没した下半分: 床が下がる深さ（m。水は板の道の 0.15 m 下まで）`),"rooms.sunken.walkM":$(1,.8,1.6,`水没した下半分: 板の道の幅（m）`),"rooms.sunken.slow":$(.45,.2,1,`水没した下半分: 水の中の歩く速さの倍率`),"rooms.terrace.riseM":$(.33,.2,.35,`段々の部屋: 1 段の高さ（m。歩いて上れる 0.35 m 以下）`),"rooms.terrace.treadM":$(.85,.7,1.2,`段々の部屋: 1 段の奥行き（m。座席の列が載る）`),"rooms.terrace.max":$(6,2,10,`段々の部屋: 段の数の上限`,!0),"rooms.eel.widthM":$(1.2,.9,1.8,`うなぎの寝床: 帯の幅（m。壁の内側）`),"rooms.endless.widthMin":$(1.9,1.4,3,`果てしない通路: 通路の幅の下限（m）`),"rooms.endless.widthMax":$(2.4,1.4,3.5,`果てしない通路: 通路の幅の上限（m）`),"rooms.endless.fogMinM":$(7,2,20,`果てしない通路: 霧で何も見えなくなる距離の下限（m）`),"rooms.endless.fogMaxM":$(13,4,40,`果てしない通路: 霧で何も見えなくなる距離の上限（m。通路の長さの 6 割まで）`),"rooms.round.minR":$(2.4,1.8,6,`円形の部屋: 丸の半径の下限（m）`),"rooms.double.gapM":$(.85,.75,1.4,`二重壁: 壁と壁の間の幅（m。体の幅 0.7 m より少し広い）`),"rooms.pillars.sizeMin":$(.45,.3,1.2,`柱林: 柱の太さの下限（m）`),"rooms.pillars.sizeMax":$(.75,.3,1.2,`柱林: 柱の太さの上限（m）`),"rooms.pillars.gapM":$(1.15,1,3,`柱林: 柱と柱の間（m。体の幅 0.7 m より広く）`),"rooms.grand.heightMul":$(1.8,1.2,3,`大広間: 天井の高さの倍率`),"rooms.grand.heightMaxM":$(10,4,20,`大広間: 天井の高さの上限（m）`),"rooms.grand.columnPitchM":$(3.2,2,6,`大広間: 列柱の間隔（m）`),"rooms.grand.chandelier":$(1.4,0,4,`大広間: シャンデリアの明るさ（区画の照明の明るさに掛ける）`),"rooms.tall.heightMinM":$(9,5,20,`縦長ホール: 天井の高さの下限（m）`),"rooms.tall.heightMaxM":$(15,5,30,`縦長ホール: 天井の高さの上限（m）`),"rooms.tall.ratio":$(2.2,1,5,`縦長ホール: 天井の高さ ÷ 部屋の幅（狭い方）`),"rooms.wells.sizeMin":$(1.4,.8,4,`天井井戸: 井戸の一辺の下限（m）`),"rooms.wells.sizeMax":$(2.4,.8,4,`天井井戸: 井戸の一辺の上限（m）`),"rooms.wells.depthMin":$(4,1.5,15,`天井井戸: 井戸の高さ（天井から上）の下限（m）`),"rooms.wells.depthMax":$(9,1.5,15,`天井井戸: 井戸の高さの上限（m）`),"rooms.wells.max":$(4,1,9,`天井井戸: 井戸の数の上限`,!0),"rooms.wells.light":$(1.6,0,5,`天井井戸: 井戸の上の灯りの明るさ（区画の照明の明るさに掛ける）`),"rooms.low.heightM":$(1.6,1.1,2,`低すぎる天井: 天井の高さ（m。プレイヤーは 1.7 m なのでしゃがんで進む）`),"rooms.low.vestibuleM":$(1.4,1.2,2.5,`低すぎる天井: 開口の前の普通の高さの所の奥行き（m）`),"rooms.high.heightM":$(30,8,40,`高すぎる天井: 天井の高さ（m）`),"rooms.high.light":$(3.2,.5,10,`高すぎる天井: 天井の蛍光灯 1 本の点光源の明るさ（区画の照明の明るさに掛ける）`),"rooms.wave.stepM":$(1.1,.6,2.5,`天井の高さが変わる: 高さを変える間隔（m。部屋の奥行きの向き）`),"rooms.wave.lowM":$(1.9,1.75,2.4,`天井の高さが変わる: いちばん低い所（m。しゃがまずに通れる）`),"rooms.wave.highAddM":$(2.6,.5,6,`天井の高さが変わる: いちばん高い所（元の天井から上へ m）`)},pa={"map.seen.distM":$(14,4,40,`地図: 開口の向こうの区画を「見た」にする距離（開口まで m）`),"map.seen.coneDeg":$(65,20,180,`地図: 開口が視線からこの角度の中にあれば向こうを見たことにする（度。すぐ近くの開口は向きによらない）`),"map.seen.hops":$(2,1,4,`地図: 扉の無い開口を続けてたどる数（扉の向こうは 1 つだけ）`,!0),"map.seen.doorOpen":$(.25,.02,1,`地図: 扉がこれより開いていれば向こうが見える（開く角度の割合）`),"map.layer.riseM":$(1.8,1,6,`地図: 上下に重なる区画を別の層に分ける高さの差（m。これより小さい段差は同じ層）`),"map.survey.tileM":$(2,1,4,`調査率: 区画の床を分ける升目の大きさ（m）`),"map.survey.radiusM":$(3,1,8,`調査率: 歩いた所からこの距離の升目を調べたことにする（m）`),"map.survey.cellFull":$(.85,.5,1,`調査率: 区画の升目のこの割合を調べると、その区画は調べ終わり（隅まで歩かなくてよい）`),"map.trail.stepM":$(1.2,.4,4,`足跡: 地図に足跡を 1 つ残す間隔（歩いた m）`),"map.trail.max":$(1500,100,6e3,`足跡: 1 フロアに残す足跡の数の上限（古いものから消える）`,!0),"map.save.floors":$(160,1,400,`地図の保存: 覚えておくフロア（果てしない階は区域）の数（古いものから忘れる）`,!0),"map.save.regions":$(150,1,400,`地図の保存: 階の地図（果てしない階）に覚えておく区域の数（古いものから忘れる）`,!0),"map.save.trail":$(600,50,6e3,`地図の保存: 区域・フロアごとに保存する足跡の数（新しいものから）`,!0),"map.story.keep":$(40,2,200,`階の地図: 地図の元を持っておく区域の数（超えたら古い区域から、見た所だけの写しにする）`,!0),"map.save.intervalSec":$(4,1,60,`地図の保存: 歩いている間の保存の間隔（秒）`),"map.erase.all":$(3,0,10,`地図が消える: 今いる部屋のほかを全部消す（重み）`),"map.erase.half":$(2,0,10,`地図が消える: 半分を消す（重み）`),"map.erase.far":$(2,0,10,`地図が消える: 遠くの部屋を消す（重み）`),"map.erase.farM":$(16,4,60,`地図が消える（遠く）: これより遠い区画を消す（m）`),"map.erase.sheets":$(48,8,120,`地図が消える: 壁と床の白紙の数の上限（箱の数）`,!0),"map.rotate.driftDeg":$(20,0,60,`地図が回る: 部屋の中で地図がゆれる幅（度）`),"map.rotate.driftSec":$(24,4,120,`地図が回る: ゆれの周期（秒）`),"map.rotate.easeSec":$(.8,.1,5,`地図が回る: 回り始め・戻りの時間（秒）`),"map.rotate.holdSec":$(30,0,300,`地図が回る: 部屋を出てから地図が戻り始めるまで（秒。出てしばらくは回ったまま）`),"map.guide.chance":$(.85,0,1,`案内図: 入口の部屋に案内図を置く確率`),"map.guide.hops":$(4,1,30,`案内図: 入口から開口をたどる数（これより先の廊下は描かない。フロア全部を描くと探す楽しみが減る）`,!0),"map.guide.lie.secret":$(3,0,10,`案内図の嘘: 隠し部屋の所に部屋を描く（重み。隠しのあるフロアだけ）`),"map.guide.lie.exit":$(1,0,10,`案内図の嘘: 出口の印を別の場所に描く（重み）`),"map.guide.lie.phantom":$(1.5,0,10,`案内図の嘘: 無い廊下を描く（重み）`),"map.guide.lie.missing":$(1.5,0,10,`案内図の嘘: ある廊下を描かない（重み）`),"map.here.chance":$(.55,0,1,`現在地の看板: 1 フロアに置く確率`),"map.here.max":$(2,0,6,`現在地の看板: 1 フロアの数の上限`,!0),"map.here.radiusM":$(16,6,40,`現在地の看板: 看板に描く範囲の半径（m）`),"map.note.chance":$(.45,0,1,`他人の地図: 1 フロアに落ちている確率`),"map.note.coverage":$(.5,.1,1,`他人の地図: 誰かが描いた区画の割合（入口から歩いた範囲）`),"map.note.wrongChance":$(.3,0,1,`他人の地図: 書き込みの 1 つが勘違い（違う所に「出口」）になる確率`),"map.fogTower.fogNearM":$(0,0,5,`霧の中の塔: 霧が掛かり始める距離（m）`),"map.fogTower.fogFarM":$(10,2,20,`霧の中の塔: 何も見えなくなる距離（m。塔の灯りだけは霧を通して見える）`),"map.fogTower.pillarPer10":$(2.2,0,8,`霧の中の塔: 床 10 m² あたり 1 本の背の高い仕切り・柱の数（迷わせる）`),"map.fogTower.awayM":$(9,3,30,`霧の中の塔（出現型の隠し）: 塔からこれより離れて`),"map.fogTower.awaySec":$(8,1,60,`霧の中の塔（出現型の隠し）: 霧の奥にいる秒数`),"map.fogTower.blinkSec":$(1.6,.3,6,`霧の中の塔: 塔の灯りの明滅の周期（秒）`),"map.blank.dwellSec":$(1.5,.3,10,`地図の空白: 空白の壁の前で立ち止まって、壁が扉になるまでの秒数（調べても開く）`)},ma={"world.slotM":$(64,40,120,`升目の一辺（m）。区域は 1 × 1・2 × 1・1 × 2・2 × 2 升目`,!0),"world.marginM":$(4.5,3,8,`区域の縁の帯（m）。境目の扉までの道を通す`),"world.split.quad":$(50,0,100,`超ブロック（2 × 2 升目）の分け方の重み: 1 × 1 が 4 つ`),"world.split.pair":$(15,0,100,`超ブロックの分け方の重み: 2 × 1 が 2 つ・1 × 2 が 2 つ（合わせて）`),"world.split.mix":$(12,0,100,`超ブロックの分け方の重み: 2 × 1（か 1 × 2）1 つと 1 × 1 が 2 つ（合わせて）`),"world.split.big":$(8,0,100,`超ブロックの分け方の重み: 2 × 2 が 1 つ`),"world.kind.district":$(50,0,100,`区域の種類の重み: 街区（v2 のフロアの型。似た雰囲気が続く）`),"world.kind.patchwork":$(50,0,100,`区域の種類の重み: 寄せ集め（v1 風。部屋ごとに雰囲気と大きさが違う）`),"world.wardSlots":$(3,1,12,`町（似た雰囲気のまとまり）の一辺の升目の数`,!0),"world.wardCoherence":$(.4,0,1,`街区が町の系統を使う確率（残りは区域ごとにばらばら）`),"world.wildcardRoomChance":$(.3,0,1,`街区の部屋が別の系統のテーマになる確率（扉を開けると急に別の施設）`),"world.gate.perEdge":$(3,1,5,`境目の扉の数: 隣の区域と接する升目の辺 1 つあたり（寄せ集めどうし）`,!0),"world.gate.perEdgeDistrict":$(2,1,4,`境目の扉の数: 升目の辺 1 つあたり（どちらかが街区。境目の扉まで廊下を引く）`,!0),"world.gate.cornerM":$(8,3,20,`境目の扉を升目の角からこれ以上離す（m）`),"world.door.moodMats":$(2,1,3,`区域の開口を扉にする雰囲気の違い: 床・壁・天井の材質がこの数以上違えば扉（系統が違えばいつも扉）`,!0),"world.gate.stubWidthM":$(2,1.4,3.2,`区域の部屋から境目の扉までの廊下の幅（m）`),"world.airlock.widthM":$(1.6,1.4,2.4,`階段室の幅（壁を含む。m）`),"world.airlock.closeSec":$(1.5,.5,4,`階段室の扉が閉まるまで（秒）`),"world.connector.lift":$(.4,0,1,`升目ごとの下りが、階段室でなくエレベーターになる確率`),"world.lift.widthM":$(2.4,2,3.2,`エレベーター: かごの外の一辺（壁を含む。m）`),"world.lift.rideSec":$(4,1,15,`エレベーター: 戸が閉まってから着くまで（秒）`),"world.lift.arriveSec":$(1.2,.3,5,`エレベーター: 着いてから戸が開くまで（秒）`),"world.hole.sizeM":$(1.4,1,2.4,`隠しの穴・着く部屋の天井の穴の一辺（m）`),"world.hole.depthM":$(30,12,60,`隠しの穴の縦穴の深さ（m）。底の手前まで移れなければ暗転して移る`),"world.hole.transferM":$(7,2,12,`隠しの穴の床からこの深さまで落ちたら、行き先の階の縦穴へ移る（m）`),"world.hole.shaftM":$(11,6,24,`着く部屋の天井の上の縦穴の高さ（m）。移った所から天井まで shaftM − transferM 落ちる`),"world.landing.sizeM":$(2.2,1.6,3,`着く部屋の天井の穴の一辺（m。沈む床の床板 2 m が通る）`),"world.hole.liftSpeed":$(1,.3,3,`沈む床・着く部屋の床板が下りる速さ（m/s）`),"world.hole.openSizeM":$(1.6,1,3,`床の穴（v1 の Hole）の一辺（m）`),"world.hole.open":$(.7,0,1,`升目ごとに床の穴が 1 つある確率`),"world.hole.open2":$(.25,0,1,`升目ごとに床の穴がもう 1 つある確率`),"world.hole.prepareM":$(14,4,40,`隠しの穴からこの距離に入ったら、行き先の階を裏で作り始める（m）`),"world.hole.holdSec":$(8,0,30,`行き先の階が用意できるまで、暗い縦穴の中で落ち続ける長さの上限（秒）`),"world.hole.darkFarM":$(4,1,12,`縦穴の中の暗さ: 霧で何も見えなくなる距離（m）`),"world.load.gateM":$(32,8,80,`境目の扉からこの距離に入ったら、向こうの区域を読む（m）`),"world.unload.gateM":$(72,20,200,`どの境目の扉からもこれより遠い区域は外す（m）`),"world.maxRegions":$(6,2,16,`同時に持つ区域の数の上限`,!0),"world.cache.regions":$(6,0,32,`外した区域の layout を覚えておく数（行き来で作り直さない）`,!0),"world.prepare.airlockM":$(20,4,60,`下りの階段室の扉からこの距離に入ったら、下の階を裏で作り始める（m）`),"world.build.hops":$(3,1,8,`区画を作る範囲: 今の区画から portal をたどる数`,!0),"world.dispose.hops":$(5,2,12,`区画を捨てる範囲: これより遠い区画は捨てる`,!0),"world.buildMs":$(10,2,40,`1 フレームに区画を作る時間（ms）`),"world.patch.minM":$(3.6,3,6,`寄せ集め: 部屋の短い辺の最小（m）`),"world.patch.hallM":$(18,10,40,`寄せ集め: この大きさを超える部屋は広間（天井が高い）`),"world.patch.keepBig":$(.3,0,1,`寄せ集め: 大きい部屋をそれ以上分けずに残す確率`),"world.patch.corridor":$(.3,0,1,`寄せ集め: 細長い通路の部屋を切り出す確率（分けるごと）`),"world.patch.loops":$(.5,0,1,`寄せ集め: 木のつながりに足す扉の割合（行き止まりばかりにしない）`),"world.patch.deadEndFix":$(.85,0,1,`寄せ集め: 扉が 1 つだけの部屋に、隣の部屋への扉を足す確率`),"world.patch.maxAspect":$(3,1.5,8,`寄せ集め: 部屋の長い辺 / 短い辺の上限（これより細長い部屋はもう一度切る）`),"world.patch.corridorMaxM":$(28,12,64,`寄せ集め: 通路を切り出す矩形の長い辺の上限（m。長い矩形は先に切り分ける）`),"world.patch.shape.straight":$(1,0,10,`寄せ集め: 通路の形の重み: まっすぐ`),"world.patch.shape.bend":$(1.4,0,10,`寄せ集め: 通路の形の重み: L 字の曲がり角`),"world.patch.shape.branch":$(1.2,0,10,`寄せ集め: 通路の形の重み: T 字の分かれ道`),"world.patch.shape.cross":$(.5,0,10,`寄せ集め: 通路の形の重み: 十字路`),"world.patch.dimChance":$(.16,0,1,`寄せ集め: 部屋が暗い（照明 0.3〜0.55 倍）確率`),"world.patch.brightChance":$(.1,0,1,`寄せ集め: 部屋がまぶしい（照明 1.25〜1.6 倍）確率`),"world.patch.tallChance":$(.14,0,1,`寄せ集め: 部屋・広間の天井が 1.5〜3.5 m 高い確率`),"world.patch.lowChance":$(.08,0,1,`寄せ集め: 部屋の天井が低い（2.3〜2.5 m）確率`),"world.patch.openChance":$(.15,0,1,`寄せ集め: 部屋どうしの出入り口を扉でなく開口にする確率`),"world.patch.voidShare":$(.2,0,.5,`寄せ集め: 部屋にせず空けておく部屋の割合（壁の向こうの見えない空き。隠し場所（レア部屋・隠し通路）を置く所）`),"world.patch.voidMinM":$(6,3,10,`寄せ集め: 空ける部屋の短い辺の下限（m。どのレア部屋も入る大きさ。小さい部屋は部屋のまま残す: 小さい部屋向きの異変（物の海など）が出なくなる）`),"world.patch.voidMaxM":$(16,6,40,`寄せ集め: 空ける部屋の長い辺の上限（m）`)},ha={"secrets.perFloorMean":$(1.2,0,10,`1 フロアあたりの隠しの平均（ポアソン分布で引く。0 個のフロアもある）`),"secrets.perFloorMax":$(4,0,16,`1 フロアの隠しの上限`,!0),"secrets.depthGain":$(0,0,1,`深さ 1 階あたり、平均に足す量`),"secrets.rarityBonusLegendary":$(1,0,5,`Legendary 以上のフロアで平均に足す量`),"secrets.nestChance":$(.15,0,1,`隠し先の中に、さらに隠しを仕込む確率`),"secrets.maxNestDepth":$(2,0,4,`入れ子の深さの上限`,!0),"secrets.visibilityCheck":ia(!0,`隠し場所が本道から見えないかを確かめる（時間がかかるなら省いてよい。ユーザー了承済み）`),"secrets.visibilityBudgetMs":$(4,0,200,`1 フロアの視線検査に使える時間（ms）。超えたら残りの検査を省く`),"secrets.visibilitySamples":$(64,1,1024,`本道の上で視線を調べる点の数`,!0),"secrets.mode.present":$(70,0,100,`存在型: 扉や穴は最初からあり、見えにくいだけ`),"secrets.mode.appear":$(30,0,100,`出現型: 条件を満たして初めて道や扉が現れる`),"secrets.dest.rareRoom":$(25,0,100,`行き止まりのレア部屋`),"secrets.dest.passageRare":$(25,0,100,`隠し通路の先にレア部屋`),"secrets.dest.loop":$(30,0,100,`隠し通路がフロアの別の部屋へ抜ける（通り抜け）`),"secrets.dest.floorLink":$(12,0,100,`下のフロア（2 つ先）への穴`),"secrets.dest.bFloor":$(8,0,100,`裏のフロアへの穴`),"secrets.throughMin":$(1,0,4,`隠しが 2 つ以上のフロアで、行き止まりでない隠し（通り抜け・穴）の最低数`,!0),"secrets.passage.widthM":$(1.3,1,2.4,`隠し通路の幅（内側）`),"secrets.passage.maxLenM":$(14,4,30,`隠し通路の長さの上限（1 本の直線）`),"secrets.rare.white":$(14,0,100,`レア部屋: 白い私室（大きすぎる椅子）`),"secrets.rare.theater":$(12,0,100,`レア部屋: 小さな劇場`),"secrets.rare.pool":$(12,0,100,`レア部屋: 水の部屋`),"secrets.rare.gallery":$(12,0,100,`レア部屋: 展示室`),"secrets.rare.library":$(12,0,100,`レア部屋: 書庫`),"secrets.rare.machine":$(10,0,100,`レア部屋: 機械の部屋`),"secrets.rare.play":$(10,0,100,`レア部屋: 遊戯室`),"secrets.rare.garden":$(10,0,100,`レア部屋: 温室`),"secrets.rare.chapel":$(8,0,100,`レア部屋: 長椅子の並ぶ部屋`),"secrets.rare.nook":$(4,0,100,`レア部屋: 灯りの小部屋（ほかの部屋が収まらないときにも使う）`),"floor.sizeM":$(70,30,200,`1 フロアの一辺の目安（m）`),"floor.baySpacingM":$(11,6,24,`区画の間隔（m）。部屋はこの中に収まり、残りが廊下になる [QR は 8]`),"floor.colsMin":$(3,1,12,`区画の格子の列の数（最小）`,!0),"floor.colsMax":$(5,1,12,`区画の格子の列の数（最大）`,!0),"floor.rowsMin":$(3,1,12,`区画の格子の行の数（最小）`,!0),"floor.rowsMax":$(5,1,12,`区画の格子の行の数（最大）`,!0),"floor.loopsPer10":$(2,0,10,`区画 10 個あたりに足すループの数（行き止まりばかりにしない）`),"floor.junctionChance":$(.3,0,1,`部屋の代わりに曲がり角（廊下の交差）にする確率`),"floor.levelHeightM":$(1.6,.6,4,`高さの違う区画の段差（m）。階段でつなぐ`),"floor.genRetries":$(6,1,30,`検証に通らなかったときに作り直す回数`,!0),"floor.roomDoorChance":$(.92,0,1,`部屋（入口・出口の部屋を除く）の出入り口を扉にする確率（扉を開けるまで中が見えない）`),"floor.hallDoorChance":$(.35,0,1,`広間の出入り口を扉にする確率`),"rarity.w.common":$(33,0,100,`Common の重み`),"rarity.w.uncommon":$(24,0,100,`Uncommon の重み`),"rarity.w.rare":$(19,0,100,`Rare の重み`),"rarity.w.epic":$(18,0,100,`Epic の重み`),"rarity.w.legendary":$(4,0,100,`Legendary の重み`),"rarity.w.mythic":$(6.5,0,100,`Mythic の重み`),"gimmick.chance.main":$(.36,0,1,`本道の上の部屋に仕掛けを置く確率`),"gimmick.chance.side":$(.45,0,1,`脇道の部屋（行き止まり・寄り道）に置く確率`),"gimmick.chance.hall":$(.7,0,1,`広間に置く確率`),"gimmick.chance.corridor":$(.3,0,1,`廊下に置く確率`),"gimmick.physicsMax":$(2,0,10,`1 フロアの物理を使う仕掛けの上限（重さ）`,!0),"gimmick.sameAxisMul":$(.3,0,1,`本道で直前の仕掛けと作用の軸が同じときの重みの倍率`),"gimmick.intenseRunMul":$(.4,0,1,`本道で強い仕掛け（強さ 2 以上）が続くときの重みの倍率`),"gimmick.secretBoost":$(3,1,20,`隠しの数に空きがある間、隠しを差し出す仕掛けの重みに掛ける倍率`),"gimmick.buildTries":$(3,1,8,`選んだ仕掛けがその部屋に組めないとき、次の候補を試す数（大きな仕掛けで部屋を空けない）`,!0),"gimmick.repeatMul":$(.35,0,1,`同じフロアに同じ仕掛けがすでにあるとき、1 つごとに重みに掛ける倍率（同じものが続かないように）`),"gimmick.tilt.slideAt":$(.55,.1,1,`傾く床: 物が滑り出す傾き（最大の傾きに対する割合。摩擦をこの傾きに合わせる）`),"gimmick.tilt.maxDeg":$(24,6,40,`傾く床: 傾きの最大（度）`),"gimmick.tilt.rateDeg":$(4,1,15,`傾く床: 傾く速さ（度/秒。立ち止まらずに渡れば大きくは傾かない）`),"gimmick.tilt.slipDeg":$(13,5,40,`傾く床: この傾きを超えると、乗っている人が低い方へ滑る（度）`),"gimmick.tilt.slipSpeed":$(3.5,.5,8,`傾く床: 最大の傾きで滑る速さ（m/s。歩いて登るのがやっと）`),"gimmick.tilt.trenchM":$(.9,.6,1.6,`傾く床: 開口も隠しも無い壁と板の間の、落ちる溝の幅（m）`),"gimmick.maze.cellM":$(1.8,1.6,2.2,`導く光の迷路: 迷路の 1 マスの大きさ（m）。仕切りは天井まで`),"gimmick.maze.lightSpeed":$(1.2,.4,3,`導く光の迷路: 光が進む速さ（m/s）`),"gimmick.maze.lead":$(2.2,1,6,`導く光の迷路: 光が先を行く距離（道に沿って m）。これより近づくと進む`),"gimmick.maze.waitDist":$(4,2,12,`導く光の迷路: これより遅れる・道から外れると光が待つ（道に沿って m）`),"gimmick.maze.ignoreSec":$(6,1,30,`導く光の迷路（出現型）: 迷路の中で光について行かない（道を外れる・遅れる）まま、行き止まりの扉が現れるまでの秒数`),"gimmick.maze.lightRange":$(4.5,2,10,`導く光の迷路: 光が照らす距離（m。仕切りの向こうへ漏れにくいよう短め）`),"gimmick.belt.speed":$(6.2,5.8,12,`一方通行の歩道: 帯の速さ（m/s）。ダッシュ（5.5）より速いので逆には進めない`),"gimmick.belt.padM":$(1.4,1.2,2,`一方通行の歩道: 乗り換えの床（分かれ目）の幅（m）`),"gimmick.belt.doorPadM":$(1.5,1.3,2.5,`一方通行の歩道: 開口の前の乗り換えの床の奥行き（m。扉を開ける間に帯へ流されない）`),"gimmick.belt.lenM":$(2,1,4,`一方通行の歩道: 帯の長さの目安（m）`),"gimmick.belt.railH":$(1.1,.95,1.6,`一方通行の歩道: 柵の高さ（m）。跳んだ高さ（約 0.9 m）より高く`),"gimmick.belt.blockChance":$(.25,0,.6,`一方通行の歩道: 道順に要らない帯を柵で塞ぐ割合`),"gimmick.belt.fightSec":$(2.5,.5,10,`一方通行の歩道（出現型）: 行き止まりの帯に逆らって歩き続けると扉が現れるまでの秒数`),"gimmick.pit.landingM":$(1.7,1.3,2.5,`穴の部屋: 開口の前の固い床の奥行き（m）`),"gimmick.pit.stairRise":$(.24,.15,.33,`穴の部屋: 戻る階段の 1 段の高さの上限（m）`),"gimmick.pit.stairTread":$(.3,.24,.45,`穴の部屋: 戻る階段の踏み面（m）`),"gimmick.pit.litM":$(3.4,2.6,6,`落ちる穴（14 章）: 穴の側壁のうち部屋の壁の続きの深さ（m。その下は暗い縦穴）`),"gimmick.pit.minGapM":$(5.6,3,9,`落ちる穴: 開口の前の固い床どうしがこれより近ければ、穴の上に低い下がり壁を付ける（m。走って跳んでも届かない間）`),"gimmick.pit.soffitM":$(2.05,1.95,2.4,`落ちる穴: 低い下がり壁の高さ（床から m。跳ぶと頭がつかえて遠くへ跳べない。歩いては通れる）`),"gimmick.pit.catwalkChance":$(.5,0,1,`落ちる穴: 穴の中に下の細い足場（隠しへの道）がある確率`),"gimmick.pit.catwalkDepthM":$(2.4,1.6,3,`落ちる穴: 下の細い足場の深さ（床から m）`),"gimmick.crumble.depthM":$(2.8,2.5,3.05,`崩れる床: 穴の深さ（m。3.1 m 以上にすると隠し部屋が隣の区画の下に入り込む）`),"gimmick.crumble.tileM":$(.9,.6,1.5,`崩れる床: 床板の大きさ（m）`),"gimmick.crumble.gapM":$(.09,.02,.2,`崩れる床: 床板の隙間（下の暗い穴が見える）`),"gimmick.crumble.standSec":$(.3,.1,2,`崩れる床: 道の床板に乗ってから揺れ始めるまで（秒。離れても止まらない。歩いて渡れば 1 枚あたり約 0.33 秒）`),"gimmick.crumble.shakeSec":$(.45,.2,3,`崩れる床: 揺れてから落ちるまで（秒）`),"gimmick.crumble.decoyChance":$(.65,0,1,`崩れる床: 道でない所が、見せかけの床板（ひび。乗るとすぐ抜ける）である確率（残りは抜けている）`),"gimmick.crumble.restChance":$(.5,0,1,`崩れる床: 道の真ん中に一息つける崩れない床板がある確率`),"gimmick.crumble.respawnSec":$(7,2,60,`崩れる床: 落ちた床板が戻るまで（秒。落ちて階段を上るあいだに戻る）`),"gimmick.narrow.depthM":$(2.6,2.1,3.05,`細い道・梁の網: 溝の深さ（m）`),"gimmick.beams.widthM":$(.46,.3,.8,`細い梁の網: 梁の幅（m）`),"gimmick.beams.platformM":$(1,.7,1.6,`細い梁の網: 分かれ目の足場の大きさ（m）`),"gimmick.beams.gapM":$(1.7,1,3,`細い梁の網: 梁の長さの目安（m）`),"gimmick.beams.loopChance":$(.12,0,.5,`細い梁の網: 木の形の網に足す余分な梁の割合（回り道）`),"anomaly.share.main":$(.42,0,1,`本道の扉の向こうの部屋（仕掛けの部屋を含む）のうち、異変の部屋にする割合の目安。空いた部屋の数で確率を割り戻す`),"anomaly.share.side":$(.35,0,1,`脇道の扉の向こうの部屋のうち、異変の部屋にする割合の目安`),"anomaly.chanceMax":$(.9,0,1,`空いた部屋 1 つに異変を掛ける確率の上限`),"anomaly.openMul":$(.25,0,1,`入口に扉の無い部屋・広間の確率の倍率（扉を開けた瞬間の驚きを優先する）`),"anomaly.runChanceMul":$(.6,0,1,`本道で直前の部屋が異変の部屋のときの確率の倍率（間に普通の部屋を挟む）`),"anomaly.intenseAfterMul":$(.25,0,1,`本道で直前の部屋が強い仕掛け・強い異変（強さ 2 以上）のとき、強い異変の重みの倍率`),"anomaly.sameRunMul":$(0,0,1,`本道で直前の部屋と同じ異変の重みの倍率（0 = 続けない）`),"anomaly.repeatMul":$(.3,0,1,`同じフロアに同じ異変がすでにあるとき、1 つごとに重みに掛ける倍率`),"anomaly.w.flood":$(1,0,10,`浸水`),"anomaly.w.giant":$(1,0,10,`巨大な家具`),"anomaly.w.tiny":$(.8,0,10,`小さな家具`),"anomaly.w.multiply":$(1,0,10,`増殖`),"anomaly.w.upsideDown":$(.8,0,10,`逆さま（Uncommon 以上）`),"anomaly.w.stack":$(.8,0,10,`積み上げ`),"anomaly.w.dark":$(1,0,10,`暗闇`),"anomaly.w.fog":$(.9,0,10,`霧`),"anomaly.w.doors":$(.7,0,10,`扉だらけ（Uncommon 以上）`),"anomaly.w.lowGravity":$(.8,0,10,`軽い部屋`),"anomaly.w.ballSea":$(.7,0,10,`物の海（物理を使う）`),"anomaly.w.tint":$(.9,0,10,`色の異変`),"anomaly.w.scatter":$(.9,0,10,`散乱`),"anomaly.w.clocks":$(.5,0,10,`時計だらけ`),"anomaly.flood.depthMin":$(.3,.1,.6,`浸水: 水深の下限（m）`),"anomaly.flood.depthMax":$(.45,.1,.6,`浸水: 水深の上限（m）`),"anomaly.flood.slow":$(.55,.2,1,`浸水: 水の中の歩く速さの倍率`),"anomaly.giant.scaleMin":$(2.5,1.5,4,`巨大な家具: 倍率の下限`),"anomaly.giant.scaleMax":$(3,1.5,4,`巨大な家具: 倍率の上限`),"anomaly.giant.max":$(5,1,12,`巨大な家具: 残す家具の数の上限（残りは片付ける）`,!0),"anomaly.tiny.scale":$(.3,.15,.6,`小さな家具: 倍率`),"anomaly.multiply.pitchMin":$(.75,.6,2,`増殖: 並べる間隔の下限（m）`),"anomaly.multiply.pitchMax":$(.95,.6,2,`増殖: 並べる間隔の上限（m）`),"anomaly.multiply.aisle":$(1.1,.9,3,`増殖: 開口から開口への通路の幅（m）`),"anomaly.multiply.max":$(150,10,400,`増殖: 並べる数の上限（広い部屋は間隔を広げる）`,!0),"anomaly.stack.towers":$(3,1,4,`積み上げ: 塔の数の上限（収まらない家具は片付ける）`,!0),"anomaly.dark.lampIntensity":$(.35,0,2,`暗闇: 遠くの小さな灯りの明るさ`),"anomaly.fog.near":$(0,0,5,`霧: 霧が掛かり始める距離（m。0 で目の前から少しずつ。近くはなんとか見える）`),"anomaly.fog.far":$(11,1,20,`霧: 何も見えなくなる距離（m。4 m で 3 割・7 m で 7 割ほど霞む）`),"anomaly.tint.red":$(1,0,10,`色の異変: 真っ赤な照明の重み`),"anomaly.tint.white":$(1,0,10,`色の異変: 色が抜けた（白い）部屋の重み`),"anomaly.lowGravity.scaleMin":$(.35,.1,1,`軽い部屋: 重さの倍率の下限`),"anomaly.lowGravity.scaleMax":$(.45,.1,1,`軽い部屋: 重さの倍率の上限`),"anomaly.lowGravity.float":$(4,0,12,`軽い部屋: 宙に浮かせる家具の数の上限`,!0),"anomaly.lowGravity.platformMinH":$(3.4,2.5,8,`軽い部屋: 宙の足場を置く天井の高さの下限（m）`),"anomaly.ballSea.max":$(100,10,300,`物の海: 転がる物（剛体）の数の上限`,!0),"anomaly.ballSea.sizeMin":$(.5,.2,.8,`物の海: 玉の直径の下限（m）`),"anomaly.ballSea.sizeMax":$(.65,.2,.8,`物の海: 玉の直径の上限（m）`),"anomaly.ballSea.doorClear":$(1.6,1.2,3,`物の海: 開口の前で玉を置かない奥行き（m）`),"anomaly.scatter.tipChance":$(.6,0,1,`散乱: 家具を倒す確率`),"anomaly.scatter.moveM":$(1.2,0,3,`散乱: 家具をずらす距離の上限（m）`),"anomaly.doors.gap":$(.25,.05,1,`扉だらけ: 扉と扉の間（m）`),"physics.tickHz":$(60,30,120,`シミュレーションの固定 tick`,!0),"physics.maxBodiesDesktop":$(400,0,4e3,`同時に動かす剛体の上限（PC）`,!0),"physics.maxBodiesMobile":$(120,0,2e3,`同時に動かす剛体の上限（スマホ）`,!0),...aa,...oa,...sa,...ca,...la,...ua,...da,...fa,...pa,...ma};Object.keys(ha);var ga={height:1.7,eye:1.6,crouchHeight:.85,crouchEye:.75,crouchSpeed:.5,eyeLerpSec:.15,radius:.35,walk:3,dash:5.5,jump:4.2,gravity:9.8,step:.35,strideWalk:.75,strideDash:1.1,surfaceSnap:.35,surfaceThickness:.6,maxFall:25},_a=Math.PI/180,va=Math.PI*2,ya={bobY:.015,bobRoll:.3*_a,bobAttackSec:.2,bobReleaseSec:.3,bobSmoothSec:.05,crouchMul:.6,dashMul:1.4,breathSec:4.5,breathY:.003,breathRollSec:6.3,breathRoll:.1*_a,wobble:.08*_a,wobbleSec:[3.1,1.3,2.3,.9],stillAfterSec:3,stillMul:.3,stillFallSec:1,stillRiseSec:.5,lagSec:.05,zoomDeg:.5,zoomSecMin:7,zoomSecMax:11},ba={off:{wobble:1,zoom:0},clean:{wobble:1,zoom:0},homeVideo:{wobble:1,zoom:1},tape:{wobble:1.2,zoom:1.2}},xa=.12,Sa=.5,Ca=class{camera;feel={handheld:.6,lag:!0,preset:`homeVideo`};suppressed=!1;zoom=1;zoomNow=1;baseFov;out={y:0,roll:0,yaw:0,pitch:0,fov:0};dispYaw=0;dispPitch=0;time=0;wasSuppressed=!1;stillScale=1;bobEnv=0;gaitPhase=0;gaitStep=0;bobY=0;bobRoll=0;fovNow=0;phase=[0,1,2,3,4].map(()=>Math.random()*va);zoomPeriod=ya.zoomSecMin+Math.random()*(ya.zoomSecMax-ya.zoomSecMin);gravQ=new R;gravTarget=new R;gravKey=``;gravBlend=0;camPrev=new y;tmpQ=new R;tmpV=new y;tmpP=new y;constructor(e){this.camera=e,this.baseFov=e.fov}snap(e){this.dispYaw=e.yaw,this.dispPitch=e.pitch}shiftYaw(e){this.dispYaw+=e}update(e,t){let n=ya,r=this.suppressed;if(r||this.wasSuppressed||!this.feel.lag)this.dispYaw=t.yaw,this.dispPitch=t.pitch;else{let r=1-Math.exp(-e/n.lagSec);this.dispYaw+=(t.yaw-this.dispYaw)*r,this.dispPitch+=(t.pitch-this.dispPitch)*r}this.wasSuppressed=r,this.time+=e;let i=this.time,a=r?0:Math.max(0,Math.min(1,this.feel.handheld)),o=ba[this.feel.preset]??ba.homeVideo,s=t.stillSec>=n.stillAfterSec?n.stillMul:1,c=(1-n.stillMul)/(s<this.stillScale?n.stillFallSec:n.stillRiseSec);this.stillScale=wa(this.stillScale,s,c*e);let l=t.onGround&&t.moveRank!==`still`,u=0;if(l){let r=t.moveRank===`dash`?ga.strideDash:ga.strideWalk;this.gaitPhase=t.strideAcc/r,this.gaitStep=t.strideCount,u=t.horizontalSpeed/r,this.bobEnv+=(1-this.bobEnv)*Math.min(1,e/n.bobAttackSec)}else this.bobEnv-=this.bobEnv*Math.min(1,e/n.bobReleaseSec);let d=(t.crouching?n.crouchMul:1)*(l&&t.moveRank===`dash`?n.dashMul:1),f=a*this.bobEnv*d*this.stillScale,p=Math.min(1,e/n.bobSmoothSec),m=Math.min(2.5,Math.sqrt(1+(va*u*n.bobSmoothSec)**2)),h=Math.min(2.5,Math.sqrt(1+(Math.PI*u*n.bobSmoothSec)**2));this.bobY+=(-n.bobY*m*f*Math.cos(va*this.gaitPhase)-this.bobY)*p,this.bobRoll+=(n.bobRoll*h*f*Math.sin(Math.PI*(this.gaitStep+this.gaitPhase))-this.bobRoll)*p;let g=a*(t.crouching?n.crouchMul:1),_=n.breathY*g*Math.sin(va*i/n.breathSec),v=n.breathRoll*g*Math.sin(va*i/n.breathRollSec+this.phase[4]),y=this.phase,b=n.wobble*a*o.wobble*this.stillScale,x=b*(.6*Math.sin(va*i/n.wobbleSec[0]+y[0])+.4*Math.sin(va*i/n.wobbleSec[1]+y[1])),S=b*(.6*Math.sin(va*i/n.wobbleSec[2]+y[2])+.4*Math.sin(va*i/n.wobbleSec[3]+y[3])),C=n.zoomDeg*a*o.zoom,w=C>0?C*Math.sin(va*i/this.zoomPeriod+y[0]):0,T=this.out;T.y=this.bobY+_,T.roll=this.bobRoll+v,T.yaw=this.dispYaw+x,T.pitch=this.dispPitch+S,T.fov=w,this.camera.position.set(t.pos[0],t.pos[1]+t.eye+(r?0:T.y),t.pos[2]),r?this.camera.rotation.set(t.pitch,t.yaw,0,`YXZ`):this.camera.rotation.set(T.pitch,T.yaw,T.roll,`YXZ`),this.applyGravity(e,t,r?0:T.y);let E=r?0:T.fov;if(E!==this.fovNow||this.zoom!==this.zoomNow){this.fovNow=E,this.zoomNow=this.zoom;let e=this.baseFov+E;this.camera.fov=this.zoom===1?e:2*Math.atan(Math.tan(e*Math.PI/360)/Math.max(1,this.zoom))*180/Math.PI,this.camera.updateProjectionMatrix()}}applyGravity(e,t,n){let r=t.grav??null,i=r?`${r.axis}${r.k}`:``;if(i!==this.gravKey&&(this.gravKey=i,r?this.gravTarget.setFromAxisAngle(this.tmpV.set(+(r.axis===`x`),0,+(r.axis===`z`)),r.k*Math.PI/2):this.gravTarget.identity(),this.gravBlend=Sa),!(this.gravBlend>0||this.gravQ.angleTo(this.gravTarget)>1e-4)&&!r){this.camPrev.copy(this.camera.position);return}this.gravQ.slerp(this.gravTarget,1-Math.exp(-e/xa)),this.gravQ.angleTo(this.gravTarget)<.001&&this.gravQ.copy(this.gravTarget),this.tmpQ.setFromEuler(this.camera.rotation),this.camera.quaternion.copy(this.gravQ).multiply(this.tmpQ),this.tmpV.set(0,t.eye+n,0).applyQuaternion(this.gravQ).add(this.tmpP.set(t.pos[0],t.pos[1],t.pos[2])),this.gravBlend>0?(this.gravBlend=Math.max(0,this.gravBlend-e),this.camera.position.copy(this.camPrev).lerp(this.tmpV,1-Math.exp(-e/.07))):this.camera.position.copy(this.tmpV),this.camPrev.copy(this.camera.position)}};function wa(e,t,n){return e<t?Math.min(t,e+n):e>t?Math.max(t,e-n):e}var Ta=[`off`,`clean`,`homeVideo`,`tape`];function Ea(e){return e===`off`||e===`clean`||e===`homeVideo`||e===`tape`}var Da=new Set;function Oa(){let e=[];for(let t of Da){if(!t.parent){Da.delete(t);continue}t.visible&&(t.visible=!1,e.push(t))}return()=>{for(let t of e)t.visible=!0}}var ka=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,Aa=`
  float lensLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`,ja={name:`LensDownsampleShader`,uniforms:{tDiffuse:{value:null},texel:{value:new m(1,1)}},vertexShader:ka,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel)
             + texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * texel)
             + texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * texel)
             + texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * texel);
      // HDR の外れ値（NaN / 極端な値）が平均を壊さないように上限を置く
      gl_FragColor = vec4(min(c.rgb * 0.25, vec3(64.0)), 1.0);
    }`},Ma={name:`LensBrightShader`,uniforms:{tDiffuse:{value:null},texel:{value:new m(1,1)},threshold:{value:1},knee:{value:.4}},vertexShader:ka,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform float threshold;
    uniform float knee;
    varying vec2 vUv;
    ${Aa}
    void main() {
      vec3 c = (texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel).rgb
              + texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * texel).rgb
              + texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * texel).rgb
              + texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * texel).rgb) * 0.25;
      float l = lensLum(c);
      // 極端な明部（鏡面の峰・至近の光源）は輝度 3 から上を 6 へ頭打ちにしてから抽出する（にじみの面積が明るさに比例して際限なく広がらない）
      if (l > 3.0) { float lc = 3.0 + (l - 3.0) / (1.0 + (l - 3.0) / 3.0); c *= lc / l; l = lc; }
      float soft = clamp(l - threshold + knee, 0.0, 2.0 * knee);
      soft = soft * soft / (4.0 * knee + 1e-4);
      float pass = max(soft, l - threshold);
      gl_FragColor = vec4(c * (pass / max(l, 1e-4)), 1.0);
    }`},Na={name:`LensBlurShader`,uniforms:{tDiffuse:{value:null},texel:{value:new m(1,1)},direction:{value:new m(1,0)},spread:{value:1.5}},vertexShader:ka,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform vec2 direction;
    uniform float spread;
    varying vec2 vUv;
    void main() {
      vec2 step = direction * texel * spread;
      vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
      c += (texture2D(tDiffuse, vUv + step * 1.3846153846).rgb + texture2D(tDiffuse, vUv - step * 1.3846153846).rgb) * 0.3162162162;
      c += (texture2D(tDiffuse, vUv + step * 3.2307692308).rgb + texture2D(tDiffuse, vUv - step * 3.2307692308).rgb) * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }`},Pa={name:`LensFlareShader`,uniforms:{tDiffuse:{value:null},texel:{value:new m(1,1)},aspect:{value:16/9},streakStep:{value:5}},vertexShader:ka,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform float aspect;
    uniform float streakStep;
    varying vec2 vUv;
    const float STREAK_GAIN = 1.2;
    vec3 ghost(vec2 uv, float scale, vec3 tint, float weight) {
      vec2 g = 0.5 - (uv - 0.5) * scale;
      float m = 1.0 - smoothstep(0.30, 0.48, length(g - 0.5));
      return max(texture2D(tDiffuse, g).rgb - 0.05, vec3(0.0)) * (m * weight) * tint;
    }
    void main() {
      vec3 streak = vec3(0.0);
      float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float w = 1.0 / (1.0 + abs(fi) * 0.7);
        vec3 s = texture2D(tDiffuse, vUv + vec2(fi * streakStep * texel.x, 0.0)).rgb;
        streak += max(s - vec3(0.05), vec3(0.0)) * w;
        wsum += w;
      }
      streak *= vec3(0.85, 0.95, 1.10) * (STREAK_GAIN / wsum);
      vec3 g = ghost(vUv, 1.8, vec3(0.70, 0.85, 1.20), 0.30) + ghost(vUv, 3.2, vec3(1.10, 0.90, 0.70), 0.20);
      gl_FragColor = vec4(streak + g, 1.0);
    }`},Fa={name:`LensStatShader`,uniforms:{tDiffuse:{value:null},cell:{value:new m(1/32,1/18)}},vertexShader:ka,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 cell;
    varying vec2 vUv;
    ${Aa}
    void main() {
      vec3 sum = vec3(0.0);
      float lsum = 0.0;
      for (int j = 0; j < 4; j++) {
        for (int i = 0; i < 4; i++) {
          vec2 o = (vec2(float(i), float(j)) + 0.5) / 4.0 - 0.5;
          vec3 c = texture2D(tDiffuse, vUv + o * cell).rgb;
          sum += c;
          lsum += log2(max(lensLum(c), 1e-4));
        }
      }
      gl_FragColor = vec4(sum / 16.0, lsum / 16.0);
    }`},Ia={name:`LensReduceShader`,uniforms:{tStat:{value:null},tDepth:{value:null},statTexel:{value:new m(1/32,1/18)},depthMode:{value:0},cameraNear:{value:.05},cameraFar:{value:100}},vertexShader:ka,fragmentShader:`
    uniform sampler2D tStat;
    uniform sampler2D tDepth;
    uniform vec2 statTexel;
    uniform int depthMode;
    uniform float cameraNear;
    uniform float cameraFar;
    float depthToDist(float d) { return (cameraNear * cameraFar) / (cameraFar - d * (cameraFar - cameraNear)); }
    void main() {
      if (gl_FragCoord.x < 1.0) {
        vec4 acc = vec4(0.0);
        for (int j = 0; j < 9; j++) {
          for (int i = 0; i < 16; i++) {
            acc += texture2D(tStat, (vec2(float(i), float(j)) * 2.0 + 1.0) * statTexel);
          }
        }
        gl_FragColor = acc / 144.0;
      } else {
        float dmin = 1e4;
        float dsum = 0.0;
        if (depthMode > 0) {
          const vec2 taps[5] = vec2[5](vec2(0.0, 0.0), vec2(0.012, 0.0), vec2(-0.012, 0.0), vec2(0.0, 0.02), vec2(0.0, -0.02));
          for (int i = 0; i < 5; i++) {
            float dist = depthToDist(texture2D(tDepth, vec2(0.5) + taps[i]).x);
            dmin = min(dmin, dist);
            dsum += dist;
          }
          dsum /= 5.0;
        } else {
          dsum = 1e4;
        }
        gl_FragColor = vec4(dmin, dsum, 0.0, 1.0);
      }
    }`},La={name:`LensCompositeShader`,uniforms:{tDiffuse:{value:null},tGlow:{value:null},tFlare:{value:null},tDepth:{value:null},resolution:{value:new m(1,1)},aspect:{value:16/9},distortion:{value:0},distScale:{value:1},chromaK:{value:0},vignette:{value:0},blurOn:{value:0},blurA:{value:new m(0,0)},blurB:{value:new m(0,0)},blurDirA:{value:new m(1,0)},blurDirB:{value:new m(0,1)},dofAmount:{value:0},dofFocus:{value:1},dofMaxPx:{value:3},glow:{value:0},halation:{value:0},flare:{value:0},haze:{value:0},hazeLevel:{value:.5},hazeClamp:{value:40},cameraNear:{value:.05},cameraFar:{value:100},depthMode:{value:0},gain:{value:new y(1,1,1)}},vertexShader:ka,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform sampler2D tGlow;
    uniform sampler2D tFlare;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform float aspect;
    uniform float distortion;
    uniform float distScale;
    uniform float chromaK;
    uniform float vignette;
    uniform float blurOn;
    uniform vec2 blurA;
    uniform vec2 blurB;
    uniform vec2 blurDirA;
    uniform vec2 blurDirB;
    uniform float dofAmount;
    uniform float dofFocus;
    uniform float dofMaxPx;
    uniform float glow;
    uniform float halation;
    uniform float flare;
    uniform float haze;
    uniform float hazeLevel;
    uniform float hazeClamp;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform int depthMode;
    uniform vec3 gain;
    varying vec2 vUv;
    ${Aa}
    float depthToDist(float d) { return (cameraNear * cameraFar) / (cameraFar - d * (cameraFar - cameraNear)); }

    // 2 重リング（内 0.55 × 4、外 1.0 × 4）+ 中心。重みは中心 0.2 / 内 0.125 / 外 0.075（合計 1）
    const vec2 DISK[8] = vec2[8](
      vec2(0.55, 0.0), vec2(0.0, 0.55), vec2(-0.55, 0.0), vec2(0.0, -0.55),
      vec2(0.7071, 0.7071), vec2(-0.7071, 0.7071), vec2(-0.7071, -0.7071), vec2(0.7071, -0.7071));
    const float DISK_W[8] = float[8](0.125, 0.125, 0.125, 0.125, 0.075, 0.075, 0.075, 0.075);
    // ハレーションの暖色（輝度 1 に正規化した橙）
    const vec3 HALATION_TINT = vec3(1.45, 0.90, 0.50);

    void main() {
      vec2 uv = vUv;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float r2 = dot(p, p);
      vec2 src = uv;
      if (distortion > 0.0) {
        // 樽型: 出力の半径が大きいほど外側を読む。distScale（= 1 / (1 + k1 rc²)）で四隅がちょうど元画像の隅に載る
        src = (p * (1.0 + distortion * r2) * distScale) / vec2(aspect, 1.0) + 0.5;
      }

      bool hasDepth = depthMode > 0;
      float dist = 0.0;
      if (hasDepth) dist = depthToDist(texture2D(tDepth, src).x);

      vec4 c0 = texture2D(tDiffuse, src);
      vec3 col = c0.rgb;
      if (blurOn > 0.5) {
        vec2 a = blurA;
        vec2 b = blurB;
        if (dofAmount > 0.0 && hasDepth) {
          float coc = dofAmount * dofMaxPx * smoothstep(dofFocus * 1.3, dofFocus * 4.0, dist);
          a += blurDirA * coc;
          b += blurDirB * coc;
        }
        vec2 texel = 1.0 / resolution;
        float R = max(length(a), length(b));
        if (R > 0.05) {
          if (R < 1.25) {
            vec2 d1 = (a + b) * texel;
            vec2 d2 = (a - b) * texel;
            col = 0.25 * (texture2D(tDiffuse, src + d1).rgb + texture2D(tDiffuse, src - d1).rgb
                        + texture2D(tDiffuse, src + d2).rgb + texture2D(tDiffuse, src - d2).rgb);
          } else {
            col *= 0.2;
            for (int i = 0; i < 8; i++) {
              vec2 o = (DISK[i].x * a + DISK[i].y * b) * texel;
              col += texture2D(tDiffuse, src + o).rgb * DISK_W[i];
            }
          }
        }
      }

      if (chromaK > 0.0) {
        vec2 off = (src - 0.5) * chromaK;
        col.r += texture2D(tDiffuse, src + off).r - c0.r;
        col.b += texture2D(tDiffuse, src - off).b - c0.b;
        col = max(col, vec3(0.0));
      }

      if (haze > 0.0 && hasDepth) {
        float h = haze * min(dist, hazeClamp) * 0.05;
        float l = lensLum(col);
        col = mix(col, vec3(l), min(1.0, h * 1.5));
        col = mix(col, vec3(hazeLevel), h);
      }

      if (glow > 0.0) {
        vec3 g = texture2D(tGlow, src).rgb;
        vec3 warm = lensLum(g) * HALATION_TINT;
        col += glow * mix(g, warm, halation);
      }
      if (flare > 0.0) col += flare * texture2D(tFlare, src).rgb;

      col *= gain;

      if (vignette > 0.0) {
        // 楕円（画面の縦横比に沿う）。四隅で vignette、辺の中央で約 0.4 倍
        vec2 q = (uv - 0.5) * 2.0;
        float rr = dot(q, q) * 0.5;
        col *= 1.0 - vignette * smoothstep(0.1, 1.0, rr);
      }

      gl_FragColor = vec4(max(col, vec3(0.0)), c0.a);
    }`},Ra={off:{distortion:0,chroma:0,vignette:0,softFocus:0,glow:0,halation:0,flare:0,dof:0,focusHunt:0,haze:0,flicker:0,motionBlur:0,autoExposure:0,autoWhiteBalance:0},clean:{distortion:0,chroma:0,vignette:0,softFocus:0,glow:0,halation:0,flare:0,dof:0,focusHunt:0,haze:.015,flicker:0,motionBlur:0,autoExposure:1,autoWhiteBalance:1},homeVideo:{distortion:.03,chroma:.7,vignette:.12,softFocus:.6,glow:.42,halation:.6,flare:.3,dof:.6,focusHunt:.6,haze:.025,flicker:.01,motionBlur:.5,autoExposure:1,autoWhiteBalance:1},tape:{distortion:.04,chroma:.7,vignette:.1,softFocus:.7,glow:.45,halation:.8,flare:.3,dof:.6,focusHunt:.8,haze:.025,flicker:.015,motionBlur:.6,autoExposure:1,autoWhiteBalance:1}},za={EXPOSURE_KEY:.032,EXPOSURE_ADAPT:.3,EXPOSURE_TAU:1.7,GAIN_MIN:.6,GAIN_MAX:1.2,WB_LIMIT:.08,WB_ADAPT:.6,WB_TAU:3,STAT_INTERVAL:4,GLOW_THRESHOLD:.8,GLOW_KNEE:.5,GLOW_SPREAD:1.5,FLARE_STEP:3,DOF_NEAR:.9,DOF_MAX_PX:3,DOF_TAU:.25,DOF_JUMP:.2,DOF_BLOCK_SEC:.35,DOF_TURN_RATE:.5,HUNT_SEC:.3,HUNT_PX:2.5,HAZE_DIST:20,HAZE_CLAMP_MAX:40,SHUTTER_SEC:1/60,MOTION_MAX_PX:24,MOTION_TAU:.06,DEPTH_SCALE:.5},Ba=32,Va=18,Ha=new m;function Ua(e){let t=Math.sin(e*12.9898)*43758.5453;return t-Math.floor(t)}var Wa=class extends _i{params={...Ra.off};exposureGain=1;luminance=0;whiteBalance=new y(1,1,1);centerDistance=1/0;statReads=0;statErrors=0;material;downMat;brightMat;blurMat;flareMat;statMat;reduceMat;depthMat;fsQuad;rtQuarter;rtEighthA;rtEighthB;rtFlare;rtStat;rtReduce=null;rtDepth=null;reduceIsFloat=!0;readBuf=new Float32Array(8);width=1;height=1;externalDepth=null;time=0;frame=0;yawRate=0;pitchRate=0;motionPx=new m;huntT=-1;logGain=0;flickPhase=0;meanColor=new y(0,0,0);statValid=!1;readPending=!1;disposed=!1;centerRaw=1/0;dofBlock=0;dofAmount=0;dofFocus=1;depthReady=!1;scene;camera;constructor(e,t){super(),this.scene=e,this.camera=t;let n=e=>new me({name:e.name,uniforms:o.clone(e.uniforms),vertexShader:e.vertexShader,fragmentShader:e.fragmentShader,depthTest:!1,depthWrite:!1,blending:0});this.material=n(La),this.downMat=n(ja),this.brightMat=n(Ma),this.blurMat=n(Na),this.flareMat=n(Pa),this.statMat=n(Fa),this.reduceMat=n(Ia),this.fsQuad=new bi(this.material),this.depthMat=new _e({depthPacking:le,side:2}),this.depthMat.colorWrite=!1,this.depthMat.blending=0;let i=e=>{let t=new r(1,1,{type:f,minFilter:h,magFilter:h,depthBuffer:!1,stencilBuffer:!1});return t.texture.name=e,t};this.rtQuarter=i(`LensPass.quarter`),this.rtEighthA=i(`LensPass.eighthA`),this.rtEighthB=i(`LensPass.eighthB`),this.rtFlare=i(`LensPass.flare`),this.rtStat=new r(Ba,Va,{type:f,minFilter:h,magFilter:h,depthBuffer:!1,stencilBuffer:!1}),this.rtStat.texture.name=`LensPass.stat`,this.material.uniforms.tGlow.value=this.rtEighthA.texture,this.material.uniforms.tFlare.value=this.rtFlare.texture,this.statMat.uniforms.cell.value.set(1/Ba,1/Va),this.reduceMat.uniforms.statTexel.value.set(1/Ba,1/Va),this.reduceMat.uniforms.tStat.value=this.rtStat.texture}applyPreset(e){Object.assign(this.params,Ra[e])}setDepthTexture(e){this.externalDepth=e}setCameraMotion(e,t){this.yawRate=Number.isFinite(e)?e:0,this.pitchRate=Number.isFinite(t)?t:0}notifyRoomEnter(){this.huntT=0,this.dofBlock=Math.max(this.dofBlock,za.DOF_BLOCK_SEC)}setSize(e,t){this.width=Math.max(1,Math.floor(e)),this.height=Math.max(1,Math.floor(t));let n=e=>Math.max(1,Math.round(e));this.rtQuarter.setSize(n(this.width/4),n(this.height/4)),this.rtEighthA.setSize(n(this.width/8),n(this.height/8)),this.rtEighthB.setSize(n(this.width/8),n(this.height/8)),this.rtFlare.setSize(n(this.width/8),n(this.height/8)),this.rtDepth&&this.rtDepth.setSize(n(this.width*za.DEPTH_SCALE),n(this.height*za.DEPTH_SCALE)),this.material.uniforms.resolution.value.set(this.width,this.height),this.material.uniforms.aspect.value=this.width/this.height,this.flareMat.uniforms.aspect.value=this.width/this.height}update(t,n){t=Math.max(0,Math.min(.1,t)),this.time+=t,this.frame=n;let r=this.params,i=this.material.uniforms,a=za,o=this.height/1080,s=this.width/this.height,c=Math.max(0,r.distortion);i.distortion.value=c,i.distScale.value=1/(1+c*(s*s+1)*.25);let l=Math.max(0,r.chroma)*o;i.chromaK.value=l>0?l*2/Math.hypot(this.width,this.height):0,i.vignette.value=Math.max(0,r.vignette);let u=0;this.huntT>=0&&(this.huntT+=t,this.huntT>=a.HUNT_SEC||r.focusHunt<=0?this.huntT=-1:u=r.focusHunt*a.HUNT_PX*o*Math.abs(Math.sin(2*Math.PI*this.huntT/a.HUNT_SEC))*(1-this.huntT/a.HUNT_SEC));let d=.5*this.height/Math.tan(e.degToRad(this.camera.fov)*.5),f=1-Math.exp(-t/a.MOTION_TAU);this.motionPx.x+=(this.yawRate*a.SHUTTER_SEC*d-this.motionPx.x)*f,this.motionPx.y+=(this.pitchRate*a.SHUTTER_SEC*d-this.motionPx.y)*f;let p=r.motionBlur>0?Math.min(a.MOTION_MAX_PX*o,this.motionPx.length()*r.motionBlur):0;p<.4*o&&(p=0);let m=Ha.copy(this.motionPx);p>0&&m.lengthSq()>1e-8?m.normalize():m.set(1,0);let h=Math.max(0,r.softFocus)*o+u;i.blurDirA.value.copy(m),i.blurDirB.value.set(-m.y,m.x),i.blurA.value.copy(m).multiplyScalar(h+p*.5),i.blurB.value.set(-m.y,m.x).multiplyScalar(h),this.dofBlock=Math.max(0,this.dofBlock-t);let g=Math.abs(this.yawRate)+Math.abs(this.pitchRate)>a.DOF_TURN_RATE,_=r.dof>0&&this.depthReady&&this.centerRaw<a.DOF_NEAR&&this.dofBlock<=0&&!g?Math.min(1,r.dof):0;this.dofAmount+=(_-this.dofAmount)*(1-Math.exp(-t/a.DOF_TAU)),_>0&&(this.dofFocus+=(this.centerRaw-this.dofFocus)*(1-Math.exp(-t/.15))),this.dofAmount<.01&&(this.dofAmount=0),i.dofAmount.value=this.dofAmount,i.dofFocus.value=Math.max(.1,this.dofFocus),i.dofMaxPx.value=a.DOF_MAX_PX*o,i.blurOn.value=+(h>.01||p>0||this.dofAmount>0),i.glow.value=Math.max(0,r.glow),i.halation.value=e.clamp(r.halation,0,1),i.flare.value=Math.max(0,r.flare),i.haze.value=Math.max(0,r.haze);let v=this.scene.fog,y=v&&v.isFog?v.far:a.HAZE_CLAMP_MAX;i.hazeClamp.value=Math.max(1,Math.min(y,a.HAZE_CLAMP_MAX)),i.hazeLevel.value=this.statValid?e.clamp(this.luminance*4,.02,.8):.4;let b=1-Math.exp(-t/a.EXPOSURE_TAU),x=0;if(r.autoExposure>0&&this.statValid&&this.luminance>0){let t=e.clamp((a.EXPOSURE_KEY/this.luminance)**+a.EXPOSURE_ADAPT,a.GAIN_MIN,a.GAIN_MAX);x=Math.log(t)*Math.min(1,r.autoExposure)}this.logGain+=(x-this.logGain)*b,this.exposureGain=Math.exp(this.logGain);let S=1-Math.exp(-t/a.WB_TAU),C=1,w=1,T=1;if(r.autoWhiteBalance>0&&this.statValid){let t=this.meanColor,n=.2126*t.x+.7152*t.y+.0722*t.z;if(n>1e-5){let i=e=>(n/Math.max(e,1e-5))**+a.WB_ADAPT,o=i(t.x),s=i(t.y),c=i(t.z),l=.2126*o+.7152*s+.0722*c,u=t=>e.clamp(t/l,1-a.WB_LIMIT,1+a.WB_LIMIT);o=u(o),s=u(s),c=u(c);let d=Math.min(1,r.autoWhiteBalance);C=1+(o-1)*d,w=1+(s-1)*d,T=1+(c-1)*d}}let E=this.whiteBalance;E.x+=(C-E.x)*S,E.y+=(w-E.y)*S,E.z+=(T-E.z)*S;let D=1;if(r.flicker>0){this.flickPhase+=(Ua(n*.618+.13)-.5)*1.2;let e=Math.sin(2*Math.PI*60*this.time+this.flickPhase);D=1+r.flicker*(.7*e+.6*(Ua(n*1.37+7.31)-.5))}i.gain.value.set(this.exposureGain*D*E.x,this.exposureGain*D*E.y,this.exposureGain*D*E.z),i.cameraNear.value=this.camera.near,i.cameraFar.value=this.camera.far}render(e,t,n){let r=this.params,i=za,a=r.dof>0||r.haze>0,o=r.glow>0||r.flare>0,s=r.autoExposure>0||r.autoWhiteBalance>0||r.haze>0||r.dof>0,c=e.autoClear;e.autoClear=!1;let l=this.externalDepth;if(!l&&a&&(l=this.renderOwnDepth(e)),this.depthReady=l!==null,this.material.uniforms.tDepth.value=l,this.material.uniforms.depthMode.value=+!!l,(o||s)&&(this.downMat.uniforms.tDiffuse.value=n.texture,this.downMat.uniforms.texel.value.set(1/this.width,1/this.height),this.draw(e,this.downMat,this.rtQuarter)),o){let t=this.rtQuarter.width,n=this.rtQuarter.height,a=this.rtEighthA.width,o=this.rtEighthA.height;this.brightMat.uniforms.tDiffuse.value=this.rtQuarter.texture,this.brightMat.uniforms.texel.value.set(1/t,1/n),this.brightMat.uniforms.threshold.value=i.GLOW_THRESHOLD,this.brightMat.uniforms.knee.value=i.GLOW_KNEE,this.draw(e,this.brightMat,this.rtEighthA),this.blurMat.uniforms.texel.value.set(1/a,1/o),this.blurMat.uniforms.spread.value=i.GLOW_SPREAD;for(let t=0;t<2;t++)this.blurMat.uniforms.tDiffuse.value=this.rtEighthA.texture,this.blurMat.uniforms.direction.value.set(1,0),this.draw(e,this.blurMat,this.rtEighthB),this.blurMat.uniforms.tDiffuse.value=this.rtEighthB.texture,this.blurMat.uniforms.direction.value.set(0,1),this.draw(e,this.blurMat,this.rtEighthA),t===0&&r.flare>0&&(this.flareMat.uniforms.tDiffuse.value=this.rtEighthA.texture,this.flareMat.uniforms.texel.value.set(1/a,1/o),this.flareMat.uniforms.streakStep.value=i.FLARE_STEP,this.draw(e,this.flareMat,this.rtFlare))}if(s&&!this.readPending&&this.statErrors<3&&this.frame%i.STAT_INTERVAL===0){let t=this.ensureReduceTarget(e);this.statMat.uniforms.tDiffuse.value=this.rtQuarter.texture,this.draw(e,this.statMat,this.rtStat);let n=this.reduceMat.uniforms;n.tDepth.value=l,n.depthMode.value=+!!l,n.cameraNear.value=this.camera.near,n.cameraFar.value=this.camera.far,this.draw(e,this.reduceMat,t),this.readPending=!0,e.readRenderTargetPixelsAsync(t,0,0,2,1,this.readBuf).then(e=>{this.readPending=!1,this.disposed||this.onStats(e)},e=>{this.readPending=!1,this.statErrors++,this.statErrors===1&&console.warn(`[LensPass] 統計の読み戻しに失敗（露出 / WB の追従を止める）`,e)})}this.material.uniforms.tDiffuse.value=n.texture,this.fsQuad.material=this.material,this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),this.clear&&e.clear()),this.fsQuad.render(e),e.autoClear=c}ensureReduceTarget(e){if(this.rtReduce)return this.rtReduce;this.reduceIsFloat=e.extensions.has(`EXT_color_buffer_float`),this.readBuf=this.reduceIsFloat?new Float32Array(8):new Uint16Array(8);let t=new r(2,1,{type:this.reduceIsFloat?O:f,minFilter:B,magFilter:B,depthBuffer:!1,stencilBuffer:!1});return t.texture.name=`LensPass.reduce`,this.rtReduce=t,t}draw(e,t,n){this.fsQuad.material=t,e.setRenderTarget(n),this.fsQuad.render(e)}renderOwnDepth(e){if(!this.rtDepth){let e=Math.max(1,Math.round(this.width*za.DEPTH_SCALE)),i=Math.max(1,Math.round(this.height*za.DEPTH_SCALE)),a=new t(e,i,n);a.format=ve,a.name=`LensPass.depth`,this.rtDepth=new r(e,i,{type:C,minFilter:B,magFilter:B,depthBuffer:!0,stencilBuffer:!1,depthTexture:a}),this.rtDepth.texture.name=`LensPass.depthColor`}let i=this.scene,a=i.background,o=i.overrideMaterial;i.background=null,i.overrideMaterial=this.depthMat;let s=Oa();try{e.setRenderTarget(this.rtDepth),e.clear(!0,!0,!1),e.render(i,this.camera)}finally{s(),i.overrideMaterial=o,i.background=a}return this.rtDepth.depthTexture}onStats(e){let t=t=>this.reduceIsFloat?e[t]:a.fromHalfFloat(e[t]),n=t(0),r=t(1),i=t(2),o=t(3),s=t(4);if(![n,r,i,o].every(Number.isFinite))return;this.statReads++,this.meanColor.set(Math.max(0,n),Math.max(0,r),Math.max(0,i)),this.luminance=2**o,this.statValid=!0;let c=this.centerRaw;this.centerRaw=Number.isFinite(s)&&s<1e3?s:1/0,this.centerDistance=this.centerRaw,Number.isFinite(c)&&Number.isFinite(this.centerRaw)&&Math.abs(this.centerRaw-c)>za.DOF_JUMP&&(this.dofBlock=Math.max(this.dofBlock,za.DOF_BLOCK_SEC))}dispose(){this.disposed=!0,this.material.dispose(),this.downMat.dispose(),this.brightMat.dispose(),this.blurMat.dispose(),this.flareMat.dispose(),this.statMat.dispose(),this.reduceMat.dispose(),this.depthMat.dispose(),this.fsQuad.dispose(),this.rtQuarter.dispose(),this.rtEighthA.dispose(),this.rtEighthB.dispose(),this.rtFlare.dispose(),this.rtStat.dispose(),this.rtReduce?.dispose(),this.rtReduce=null,this.rtDepth&&=(this.rtDepth.depthTexture?.dispose(),this.rtDepth.dispose(),null)}};function Ga(){return{tDiffuse:{value:null},tPrev:{value:null},resolution:{value:new m(1,1)},seed:{value:0},desaturate:{value:0},tint:{value:new y(1,1,1)},chromaBlur:{value:0},noiseAmp:{value:0},colorNoise:{value:0},blackLift:{value:0},knee:{value:0},scanlines:{value:0},interlaceMix:{value:0},frameBlend:{value:0},dctBlocks:{value:0},blockSeed:{value:0},jitterBand:{value:new k(0,0,0,0)},headBand:{value:new k(0,0,0,0)},lumaBlur:{value:0},chromaShift:{value:0},smear:{value:0},ringing:{value:0},vignette:{value:0},lineJitter:{value:0},snow:{value:0},tracking:{value:0},chromaNoise:{value:0},timeSec:{value:0}}}var Ka={name:`VideoShader`,vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform sampler2D tPrev;
    uniform vec2 resolution;
    uniform float seed;
    uniform float desaturate;
    uniform vec3 tint;
    uniform float chromaBlur;
    uniform float noiseAmp;
    uniform float colorNoise;
    uniform float blackLift;
    uniform float knee;
    uniform float scanlines;
    uniform float interlaceMix;
    uniform float frameBlend;
    uniform float dctBlocks;
    uniform float blockSeed;
    uniform vec4 jitterBand;
    uniform vec4 headBand;
    uniform float lumaBlur;
    uniform float chromaShift;
    uniform float smear;
    uniform float ringing;
    uniform float vignette;
    uniform float lineJitter;
    uniform float snow;
    uniform float tracking;
    uniform float chromaNoise;
    uniform float timeSec;
    varying vec2 vUv;

    // BT.601（SD ビデオ）の輝度・色差
    const vec3 LUMA = vec3(0.299, 0.587, 0.114);
    const vec3 CB = vec3(-0.168736, -0.331264, 0.5);
    const vec3 CR = vec3(0.5, -0.418688, -0.081312);

    // PCG ハッシュ（整数）。ピクセル座標 + seed で解像度に依らない一様乱数
    uint pcg(uint v) {
      uint s = v * 747796405u + 2891336453u;
      uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
      return (w >> 22u) ^ w;
    }
    float hashU(uvec2 p, uint s) {
      return float(pcg(p.x + pcg(p.y + pcg(s)))) * (1.0 / 4294967296.0);
    }

    #ifdef COLOR_STAGE
    vec3 colorStage(vec2 uv, vec2 px, uvec2 ip) {
      float scale1080c = resolution.y / 1080.0;
      vec3 rgb = texture2D(tDiffuse, uv).rgb;
      float y0 = dot(rgb, LUMA);

      // 2a. 輝度の横ぼかし（VHS の輝度帯域 ≈ 240 本）: 5 タップ（1 2 3 2 1 / 9）。輪郭が横方向にだけ甘くなる
      float y = y0;
      float yWide = y0;
      if (lumaBlur > 0.0 || ringing > 0.0) {
        float lr = max(lumaBlur, 1.2) * scale1080c * px.x;
        float acc = 3.0 * y0;
        float accW = 0.0;
        for (int i = 1; i <= 2; i++) {
          float a = dot(texture2D(tDiffuse, vec2(uv.x - float(i) * lr * 0.5, uv.y)).rgb, LUMA);
          float b = dot(texture2D(tDiffuse, vec2(uv.x + float(i) * lr * 0.5, uv.y)).rgb, LUMA);
          float w = 3.0 - float(i);
          acc += w * (a + b);
          accW += a + b;
        }
        float yb = acc / 9.0;
        yWide = (accW + y0) / 5.0;
        y = mix(y0, yb, min(lumaBlur, 1.0));
      }

      // 2b. 色のにじみ（クロマサブサンプリング）: 色差だけ横に 7 タップ（1 2 3 4 3 2 1 / 16）ぼかし、右へ chromaShift ぶん遅らせる。
      //     行ごとの色相ずれ（chromaNoise）はテープの色同期の甘さ
      vec2 cc = vec2(dot(rgb, CB), dot(rgb, CR));
      if (chromaBlur > 0.0) {
        float r = chromaBlur * scale1080c;
        float stepX = r / 3.0 * px.x;
        float delay = (r * 0.35 + chromaShift * scale1080c) * px.x;
        cc = vec2(0.0);
        for (int i = -3; i <= 3; i++) {
          vec3 sm = texture2D(tDiffuse, vec2(uv.x - delay + float(i) * stepX, uv.y)).rgb;
          float w = 4.0 - abs(float(i));
          cc += w * vec2(dot(sm, CB), dot(sm, CR));
        }
        cc *= 1.0 / 16.0;
      }
      if (chromaNoise > 0.0) {
        float rowN = hashU(uvec2(ip.y / 2u, 3u), uint(seed) + 29u) - 0.5;
        float rowM = hashU(uvec2(ip.y / 2u, 4u), uint(seed) + 31u) - 0.5;
        cc += vec2(rowN, rowM) * chromaNoise * 0.05;
      }
      // 2c. 明部の右への滲み（テープの smear）: 左側 6 タップの明部（0.55 超）を減衰させて足す。暖色寄り
      float sm = 0.0;
      if (smear > 0.0) {
        float sstep = 3.0 * scale1080c * px.x;
        for (int i = 1; i <= 6; i++) {
          float l = dot(texture2D(tDiffuse, vec2(uv.x - float(i) * sstep, uv.y)).rgb, LUMA);
          sm += max(l - 0.55, 0.0) * (1.0 - float(i) / 7.0);
        }
        sm *= smear * 0.35;
      }
      // 2d. リンギング: 輝度と広いぼかしの差を足し戻して縁に明暗の線を出す（強調回路の出過ぎ）
      if (ringing > 0.0) y += (y0 - yWide) * ringing * 1.4;
      y += sm;
      rgb = vec3(y + 1.402 * cc.y, y - 0.344136 * cc.x - 0.714136 * cc.y, y + 1.772 * cc.x) + sm * vec3(0.10, 0.03, -0.04);

      // 1. 色調整: 彩度低下と白点の偏り（RGB ゲイン）
      float luma = dot(rgb, LUMA);
      rgb = mix(vec3(luma), rgb, 1.0 - desaturate) * tint;

      // 5. ハイライトのニー: 折れ点（knee 0→0.92、1→0.85）以上の傾きを 1 − 0.75 knee に落とす（肩ではなく折れ）。チャンネル別なので白に近い色は少し色が残る
      if (knee > 0.0) {
        float kp = mix(0.92, 0.85, knee);
        float slope = 1.0 - 0.75 * knee;
        vec3 over = max(rgb - kp, vec3(0.0));
        rgb += over * (slope - 1.0);
      }

      // 4. 黒レベルの浮きと圧縮: lift + (1 − lift) x のあと、toe（0.22）以下の傾きを二次曲線で緩める（0 での傾き ≈ 1 − 3 lift）
      if (blackLift > 0.0) {
        rgb = blackLift + (1.0 - blackLift) * rgb;
        const float toe = 0.22;
        vec3 d = max(toe - rgb, vec3(0.0));
        rgb += (blackLift * 1.5) * d * d / toe;
      }

      // 10. DCT ブロックの気配: 8 px ブロックごとに量子化（2/255 刻み）の位相をずらす → 暗部の緩い勾配に境界の段差が出る。
      //     ブロックごとの DC の偏り（±0.75/255）も足す。暗部だけ（luma 0.06→0.35 で消える）。位相は 0.5 s ごとに変わる（GOP のつもり）
      if (dctBlocks > 0.0) {
        uvec2 blk = ip / 8u;
        float bh = hashU(blk, uint(blockSeed) + 7u) - 0.5;
        float dark = 1.0 - smoothstep(0.06, 0.35, dot(rgb, LUMA));
        const float q = 128.0;
        vec3 qz = floor(rgb * q + 0.5 + bh) / q + bh * (1.5 / 255.0);
        rgb = mix(rgb, qz, dctBlocks * dark);
      }
      return rgb;
    }
    #endif

    void main() {
      vec2 px = 1.0 / resolution;
      uvec2 ip = uvec2(gl_FragCoord.xy);
      uint s = uint(seed);
      vec2 uv = vUv;
      float inHead = 0.0;

      #ifdef FINAL_STAGE
      float scale1080 = resolution.y / 1080.0;
      // 7a. 行ごとの横揺れ（トラッキングの甘さ）: 行のハッシュ + ゆっくり流れる波（2 行単位、下端ほど強い）
      if (lineJitter > 0.0) {
        float rowJ = hashU(uvec2(ip.y / 2u, 9u), s + 23u) - 0.5;
        float wave = sin(vUv.y * 40.0 + timeSec * 1.7) * 0.35 + sin(vUv.y * 7.0 - timeSec * 0.6) * 0.25;
        float bottom = 1.0 + 2.0 * smoothstep(0.35, 0.0, vUv.y);
        uv.x += (rowJ * 0.6 + wave * 0.4) * lineJitter * bottom * scale1080 * px.x;
      }
      // 7. テープの揺れ（水平同期ずれ）: 行帯の中だけ横にずらす。帯の上端で最大、下へ向かって同期が戻る（t^1.5）
      if (jitterBand.w > 0.0) {
        float t = (vUv.y - jitterBand.x) / max(jitterBand.y - jitterBand.x, 1e-4);
        float inJ = step(0.0, t) * step(t, 1.0) * jitterBand.w;
        uv.x += inJ * t * sqrt(t) * jitterBand.z * scale1080 * px.x;
      }
      // 8. ヘッド切替ノイズ: 画面下端の帯。行ごとに違う横ずれ（下へ行くほど大きい）
      if (headBand.z > 0.0) {
        inHead = step(vUv.y, headBand.x) * headBand.z;
        float k = 1.0 - vUv.y / max(headBand.x, 1e-4);
        float rowH = hashU(uvec2(ip.y, 0u), s + 11u) - 0.5;
        uv.x += inHead * (headBand.y * (0.5 + 0.5 * k) + rowH * headBand.y * 0.8) * scale1080 * px.x;
      }
      #endif

      #ifdef COLOR_STAGE
      vec3 rgb = colorStage(uv, px, ip);
      #ifdef HAS_PREV
      // 9. フレーム間引きの残像 / 6. コーミング（奇数行だけ前フレーム）。前フレームは揺れの無い座標で採る
      vec3 prev = texture2D(tPrev, vUv).rgb;
      if (frameBlend > 0.0) rgb = mix(rgb, prev, frameBlend);
      if (interlaceMix > 0.0) rgb = mix(rgb, prev, interlaceMix * float(ip.y & 1u));
      #endif
      #else
      vec3 rgb = texture2D(tDiffuse, uv).rgb;
      #endif

      #ifdef FINAL_STAGE
      // 12. 常時のトラッキング帯: 画面下端 0〜3% がざらつき、行ごとに横ずれし、上端がちらつく
      if (tracking > 0.0) {
        float th = tracking * 0.03;
        float inT = step(vUv.y, th);
        if (inT > 0.0) {
          float k = 1.0 - vUv.y / max(th, 1e-4);
          float rowT = hashU(uvec2(ip.y, 5u), s + 37u) - 0.5;
          vec3 shifted = texture2D(tDiffuse, vec2(uv.x + rowT * 14.0 * k * scale1080 * px.x, uv.y)).rgb;
          float tn = hashU(ip, s + 41u);
          rgb = mix(rgb, shifted * (0.6 + 0.8 * tn) + (tn - 0.5) * 0.5 * k, 0.85);
        }
      }
      // 14. スノー: 暗部に散る白い点（画素の 0.15% × snow）
      if (snow > 0.0) {
        float l = dot(rgb, LUMA);
        float dark = 1.0 - smoothstep(0.1, 0.5, l);
        float sn = hashU(ip, s + 61u);
        if (sn < 0.0015 * snow * (0.3 + 0.7 * dark)) rgb += vec3(0.35 + 0.45 * hashU(ip, s + 67u));
      }
      // 8. ヘッド切替の帯: 行ごとの明滅 + 粗いノイズ（白い線は出さない）
      if (inHead > 0.0) {
        float fl = 1.0 + (hashU(uvec2(ip.y, 1u), s + 13u) - 0.5) * 1.2 * headBand.w;
        vec3 noisy = rgb * fl + (hashU(ip, s + 17u) - 0.5) * 0.4;
        rgb = mix(rgb, noisy, inHead);
      }
      // 15. 四隅の減光: 楕円の外側だけ（辺の中央はほとんど変えない）
      if (vignette > 0.0) {
        vec2 q = (vUv - 0.5) * 2.0;
        float rr = dot(q, q) * 0.5;
        rgb *= 1.0 - vignette * smoothstep(0.32, 1.0, rr);
      }
      // 6. 走査線: 2 px 周期（出力ピクセル基準）の弱い暗線
      if (scanlines > 0.0) rgb *= 1.0 - scanlines * ${.15.toFixed(2)} * float(ip.y & 1u);
      // 3. 暗部ノイズ: 輝度が低いほど強い（暗部 1.0 / 明部 0.3）。色ノイズは青を多めに（0.8 / 0.7 / 1.3）
      if (noiseAmp > 0.0) {
        float l = dot(rgb, LUMA);
        float dark = 1.0 - smoothstep(0.04, 0.6, l);
        float amp = noiseAmp * (0.3 + 0.7 * dark) * 2.0;
        float n = hashU(ip, s) - 0.5;
        vec3 cn = (vec3(hashU(ip, s + 1u), hashU(ip, s + 2u), hashU(ip, s + 3u)) - 0.5) * vec3(0.8, 0.7, 1.3);
        rgb += amp * mix(vec3(n), cn, colorNoise);
      }
      #endif

      gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
    }`},qa={off:{desaturate:0,tint:[1,1,1],chromaBlur:0,noise:0,colorNoise:0,blackLift:0,knee:0,scanlines:0,interlace:0,jitter:0,headSwitch:0,dctBlocks:0,frameHold:0,frameBlend:0,lumaBlur:0,chromaShift:0,smear:0,ringing:0,vignette:0,lineJitter:0,snow:0,tracking:0,chromaNoise:0},clean:{desaturate:.05,tint:[1,1,1],chromaBlur:0,noise:0,colorNoise:0,blackLift:0,knee:0,scanlines:0,interlace:0,jitter:0,headSwitch:0,dctBlocks:0,frameHold:0,frameBlend:0,lumaBlur:0,chromaShift:0,smear:0,ringing:0,vignette:.12,lineJitter:0,snow:0,tracking:0,chromaNoise:0},homeVideo:{desaturate:.12,tint:[1,1,.97],chromaBlur:3.3,noise:.019,colorNoise:.4,blackLift:.012,knee:.45,scanlines:.2,interlace:.12,jitter:.025,headSwitch:.035,dctBlocks:0,frameHold:0,frameBlend:0,lumaBlur:.8,chromaShift:1,smear:.25,ringing:.2,vignette:.2,lineJitter:.3,snow:.05,tracking:0,chromaNoise:.15},tape:{desaturate:.24,tint:[1.03,1,.93],chromaBlur:10,noise:.046,colorNoise:.6,blackLift:.045,knee:.85,scanlines:.7,interlace:.4,jitter:.45,headSwitch:.5,dctBlocks:.2,frameHold:30,frameBlend:.06,lumaBlur:3.2,chromaShift:4.5,smear:1,ringing:.8,vignette:.32,lineJitter:2,snow:.15,tracking:.85,chromaNoise:.75}},Ja=.02,Ya=.58,Xa=.6,Za=4,Qa=3,$a=4096,eo=class extends _i{params={...qa.off,tint:[1,1,1]};frozenSeed=null;strength=1;eff={...qa.off,tint:[1,1,1]};effective(){let e=this.params,t=this.strength,n=this.eff,r=(e,n)=>Math.min(n,e*t);return n.desaturate=r(e.desaturate,.6),n.tint=[1+(e.tint[0]-1)*t,1+(e.tint[1]-1)*t,1+(e.tint[2]-1)*t],n.chromaBlur=r(e.chromaBlur,24),n.noise=r(e.noise,.12),n.colorNoise=Math.min(1,e.colorNoise),n.blackLift=r(e.blackLift,.12),n.knee=r(e.knee,1),n.scanlines=r(e.scanlines,1),n.interlace=r(e.interlace,.6),n.jitter=r(e.jitter,1),n.headSwitch=r(e.headSwitch,1),n.dctBlocks=r(e.dctBlocks,1),n.frameHold=e.frameHold,n.frameBlend=r(e.frameBlend,.2),n.lumaBlur=r(e.lumaBlur,8),n.chromaShift=r(e.chromaShift,12),n.smear=r(e.smear,2.5),n.ringing=r(e.ringing,2),n.vignette=r(e.vignette,.55),n.lineJitter=r(e.lineJitter,5),n.snow=r(e.snow,.5),n.tracking=r(e.tracking,1.2),n.chromaNoise=r(e.chromaNoise,2),n}uniforms;singleMaterial;colorMaterial;finalMaterial;fsQuad;width=1;height=1;targets=null;readIndex=0;prevValid=!1;audioNoise=0;audioSmooth=0;stillness=0;time=0;holdAcc=0;captureThisFrame=!0;jitterLeft=0;jitterState={y0:0,y1:0,shift:0};headLeft=0;headState={height:.025,shift:0,flicker:1};forced=!1;rngState=2654435769;constructor(){super(),this.uniforms=Ga();let e=e=>new me({name:`VideoShader[${Object.keys(e).join(`+`)}]`,uniforms:this.uniforms,defines:e,vertexShader:Ka.vertexShader,fragmentShader:Ka.fragmentShader,depthTest:!1,depthWrite:!1});this.singleMaterial=e({COLOR_STAGE:``,FINAL_STAGE:``}),this.colorMaterial=e({COLOR_STAGE:``,HAS_PREV:``}),this.finalMaterial=e({FINAL_STAGE:``}),this.fsQuad=new bi(this.singleMaterial)}applyPreset(e){let t=qa[e];Object.assign(this.params,t,{tint:[...t.tint]})}setAudioNoise(e){this.audioNoise=Math.max(0,Math.min(1,e))}setStillness(e){this.stillness=Math.max(0,e)}forceJitter(e=30){this.jitterState.y0=.42,this.jitterState.y1=.5,this.jitterState.shift=4,this.jitterLeft=Math.max(1,e|0),this.forced=!0}forceHeadSwitch(e=30){this.headState.height=.025,this.headState.shift=8,this.headState.flicker=1,this.headLeft=Math.max(1,e|0),this.forced=!0}update(e,t){let n=this.effective(),r=this.uniforms;this.time+=e;let i=this.frozenSeed!==null,a=i?Math.floor(this.frozenSeed):t;r.seed.value=(a%$a+$a)%$a,this.audioSmooth+=(this.audioNoise-this.audioSmooth)*Math.min(1,e*4);let o=Math.max(0,Math.min(1,(this.audioSmooth-Ja)/Ya));r.noiseAmp.value=n.noise*(1+Xa*o);let s=this.stillness>3;if(this.forced&&this.jitterLeft<=0&&this.headLeft<=0&&(this.forced=!1),s&&!this.forced?(this.jitterLeft=0,this.headLeft=0):!s&&!i&&(this.jitterLeft<=0&&n.jitter>0&&this.rng()<n.jitter*Za*e&&this.startJitter(),this.headLeft<=0&&n.headSwitch>0&&this.rng()<n.headSwitch*Qa*e&&this.startHeadSwitch()),this.jitterLeft>0?(r.jitterBand.value.set(this.jitterState.y0,this.jitterState.y1,this.jitterState.shift,1),this.jitterLeft--):r.jitterBand.value.w=0,this.headLeft>0?(r.headBand.value.set(this.headState.height,this.headState.shift,1,this.headState.flicker),this.headLeft--):r.headBand.value.z=0,n.frameHold>0){let t=1/n.frameHold;this.holdAcc+=e,this.holdAcc>=t*.75?(this.captureThisFrame=!0,this.holdAcc=Math.min(this.holdAcc-t,t)):this.captureThisFrame=!1}else this.captureThisFrame=!0,this.holdAcc=0;r.desaturate.value=n.desaturate,r.tint.value.set(n.tint[0],n.tint[1],n.tint[2]),r.chromaBlur.value=n.chromaBlur,r.colorNoise.value=n.colorNoise,r.blackLift.value=n.blackLift,r.knee.value=n.knee,r.scanlines.value=n.scanlines,r.dctBlocks.value=n.dctBlocks,r.blockSeed.value=Math.floor(this.time*2)%$a,r.lumaBlur.value=n.lumaBlur,r.chromaShift.value=n.chromaShift,r.smear.value=n.smear,r.ringing.value=n.ringing,r.vignette.value=n.vignette,r.lineJitter.value=s&&!this.forced?n.lineJitter*.3:n.lineJitter,r.snow.value=n.snow,r.tracking.value=n.tracking,r.chromaNoise.value=n.chromaNoise,r.timeSec.value=this.time}setSize(e,t){if(this.width=Math.max(1,e|0),this.height=Math.max(1,t|0),this.uniforms.resolution.value.set(this.width,this.height),this.targets){for(let e of this.targets)e.setSize(this.width,this.height);this.prevValid=!1}}render(e,t,n){let r=this.effective(),i=this.uniforms,a=this.renderToScreen?null:t;if(!(r.interlace>0||r.frameHold>0)){this.releaseTargets(),i.tDiffuse.value=n.texture,i.interlaceMix.value=0,i.frameBlend.value=0,this.draw(e,this.singleMaterial,a,this.clear);return}let o=this.ensureTargets();if(this.captureThisFrame||!this.prevValid){let t=o[this.readIndex],a=o[1-this.readIndex];i.tDiffuse.value=n.texture,i.tPrev.value=t.texture,i.interlaceMix.value=this.prevValid?r.interlace:0,i.frameBlend.value=this.prevValid&&r.frameHold>0?r.frameBlend:0,this.draw(e,this.colorMaterial,a,!1),this.readIndex=1-this.readIndex,this.prevValid=!0}i.tDiffuse.value=o[this.readIndex].texture,this.draw(e,this.finalMaterial,a,this.clear)}dispose(){this.releaseTargets(),this.singleMaterial.dispose(),this.colorMaterial.dispose(),this.finalMaterial.dispose(),this.fsQuad.dispose()}draw(e,t,n,r){e.setRenderTarget(n),n&&r&&e.clear(),this.fsQuad.material=t,this.fsQuad.render(e)}ensureTargets(){if(this.targets)return this.targets;let e=e=>{let t=new r(this.width,this.height,{type:C,format:i,minFilter:h,magFilter:h,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1,colorSpace:``});return t.texture.name=`VideoPass.prev${e}`,t};return this.targets=[e(0),e(1)],this.readIndex=0,this.prevValid=!1,this.targets}releaseTargets(){if(this.targets){for(let e of this.targets)e.dispose();this.targets=null,this.prevValid=!1,this.uniforms.tPrev.value=null}}startJitter(){let e=.02+this.rng()*.1;this.jitterState.y0=this.rng()*(1-e),this.jitterState.y1=this.jitterState.y0+e,this.jitterState.shift=(2+this.rng()*4)*(this.rng()<.5?-1:1),this.jitterLeft=this.rng()<.4?2:1}startHeadSwitch(){this.headState.height=.02+this.rng()*.01,this.headState.shift=4+this.rng()*8,this.headState.flicker=.6+this.rng()*.4,this.headLeft=2+Math.floor(this.rng()*4)}rng(){this.rngState=this.rngState+1831565813|0;let e=this.rngState;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}},to=class{visible=!1;parent;date=`2003.07.14`;elapsed=0;root=null;dot=null;tc=null;lastTc=``;lastDotOn=!0;constructor(e=typeof document<`u`?document.body:null){this.parent=e}setVisible(e){if(e!==this.visible){if(this.visible=e,e){let e=this.ensureDom();e&&(e.style.display=``,this.lastTc=``,this.refresh())}else this.root&&(this.root.style.display=`none`)}}get isVisible(){return this.visible}update(e){this.elapsed+=Math.max(0,e),this.visible&&this.root&&this.refresh()}dispose(){this.root?.remove(),this.root=null,this.dot=null,this.tc=null,this.visible=!1}ensureDom(){if(this.root)return this.root;if(!this.parent||typeof document>`u`)return null;let e=this.parent.ownerDocument??document,t=e.createElement(`div`);t.id=`rec-overlay`,t.setAttribute(`aria-hidden`,`true`),t.style.cssText=[`position:fixed`,`inset:0`,`pointer-events:none`,`z-index:5`,`user-select:none`,`font:12px/1 ui-monospace, Menlo, Consolas, "Courier New", monospace`,`letter-spacing:0.08em`,`color:rgba(255,255,255,0.8)`,`text-shadow:0 1px 2px rgba(0,0,0,0.7)`].join(`;`);let n=e.createElement(`div`);n.style.cssText=`position:absolute;right:calc(16px + env(safe-area-inset-right, 0px));top:calc(14px + env(safe-area-inset-top, 0px));display:flex;align-items:center;gap:6px`;let r=e.createElement(`span`);r.style.cssText=`display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff2b2b;box-shadow:0 0 6px rgba(255,43,43,0.7)`;let i=e.createElement(`span`);i.textContent=`REC`,n.append(r,i);let a=e.createElement(`div`);return a.style.cssText=`position:absolute;left:calc(16px + env(safe-area-inset-left, 0px));bottom:calc(16px + env(safe-area-inset-bottom, 0px));white-space:pre`,t.append(n,a),this.parent.appendChild(t),this.root=t,this.dot=r,this.tc=a,t}refresh(){if(!this.dot||!this.tc)return;let e=this.elapsed%1<.5;e!==this.lastDotOn&&(this.lastDotOn=e,this.dot.style.opacity=e?`1`:`0`);let t=`${this.dateText()}  ${no(this.elapsed)}`;t!==this.lastTc&&(this.lastTc=t,this.tc.textContent=t)}dateText(){if(this.date!==`auto`)return this.date;let e=new Date;return`${e.getFullYear()}.${ro(e.getMonth()+1)}.${ro(e.getDate())}`}};function no(e){let t=Math.max(0,e),n=Math.floor(t/3600)%100,r=Math.floor(t/60)%60,i=Math.floor(t)%60,a=Math.floor((t-Math.floor(t))*30)%30;return`${ro(n)}:${ro(r)}:${ro(i)}:${ro(a)}`}function ro(e){return e<10?`0${e}`:String(e)}var io={preset:`off`,vhsStrength:2,handheld:.6,cameraLag:!0,frameHold:`off`,rec:!0,autoExposure:!1,autoWhiteBalance:!1,colorKeep:.85},ao=`vsl.film.v1`,oo=`
uniform sampler2D tSrc; uniform vec2 uRes; uniform float uScale; varying vec2 vUv;
${xi}
void main() {
  vec3 c = clamp(texture2D(tSrc, vUv).rgb / uScale, 0.0, 1.0);
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  c += (sl_hash12(vUv * uRes * 1.37) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`,so=class{settings;lens;video;rig;rec;rtLinear;rtLens;rtDisplay;encode;frame=0;strideAcc=0;strideCount=0;stillSec=0;lastPos=new y;lastYaw=0;lastPitch=0;hasLast=!1;onChange=null;constructor(e,t,n,i=!0){this.settings={...io,...i?co():{}},this.persist=i,this.lens=new Wa(e,t),this.video=new eo,this.video.renderToScreen=!0,this.adaptVideoShader(),this.rig=new Ca(t),this.rec=new to(n);let a=e=>{let t=new r(1,1,{type:f,depthBuffer:!1,stencilBuffer:!1});return t.texture.name=e,t.texture.colorSpace=``,t.texture.generateMipmaps=!1,t};this.rtLinear=a(`Film.linear`),this.rtLens=a(`Film.lens`),this.rtDisplay=a(`Film.display`),this.encode=new bi(new me({vertexShader:`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:oo,uniforms:{tSrc:{value:null},uRes:{value:new m},uScale:{value:1}},depthTest:!1,depthWrite:!1})),this.apply()}persist;inputScale=.5;smearKnee={value:.9};colorKeepU={value:.85};get active(){return this.settings.preset!==`off`}get linearTarget(){return this.rtLinear}set(t,n=!0){Object.assign(this.settings,t),Ea(this.settings.preset)||(this.settings.preset=`off`),this.settings.vhsStrength=e.clamp(this.settings.vhsStrength,0,2),this.settings.handheld=e.clamp(this.settings.handheld,0,1),this.settings.colorKeep=e.clamp(Number.isFinite(this.settings.colorKeep)?this.settings.colorKeep:io.colorKeep,0,1),this.apply(),this.persist&&n&&lo(this.settings),this.onChange?.()}apply(){let e=this.settings;this.lens.applyPreset(e.preset),this.lens.params.autoExposure=e.autoExposure?this.lens.params.autoExposure:0,this.lens.params.autoWhiteBalance=e.autoWhiteBalance?this.lens.params.autoWhiteBalance:0,this.video.applyPreset(e.preset),this.video.strength=e.vhsStrength;let t=qa[e.preset];this.video.params.frameHold=e.frameHold===`off`?t.frameHold:Number(e.frameHold),this.video.params.frameBlend=this.video.params.frameHold>0?Math.max(t.frameBlend,.06):t.frameBlend;let n=e.colorKeep,r=Math.max(e.vhsStrength,.001),i=(e,t,i)=>Math.min(t,e*r)*(1-i*n)/r;this.colorKeepU.value=n,this.video.params.chromaBlur=i(t.chromaBlur,24,.4),this.video.params.blackLift=i(t.blackLift,.12,.6),this.video.params.knee=i(t.knee,1,.5),this.video.params.chromaNoise=i(t.chromaNoise,2,.5),this.video.params.vignette=i(t.vignette,.55,.5),this.rig.feel.handheld=this.active?e.handheld:0,this.rig.feel.lag=this.active&&e.cameraLag,this.rig.feel.preset=e.preset,this.rec.setVisible(this.active&&e.rec)}adaptVideoShader(){let e=this.video;for(let t of[`singleMaterial`,`colorMaterial`,`finalMaterial`]){let n=e[t];if(!n)continue;let r=n.fragmentShader,i=r.replace(`max(l - 0.55, 0.0)`,`max(l - smearKnee, 0.0)`);i===r?t===`singleMaterial`&&console.warn(`[Film] VideoShader の滲みのしきい値が見つからない（v2 のまま使う）`):(r=i.replace(`uniform float smear;`,`uniform float smear;
uniform float smearKnee;`),n.uniforms.smearKnee=this.smearKnee);let a=r.replace(`rgb *= 1.0 - scanlines * 0.15 * float(ip.y & 1u);`,`rgb *= 1.0 - scanlines * 0.15 * (float(ip.y & 1u) - 0.5 * colorKeep);`);a===r&&t===`finalMaterial`&&console.warn(`[Film] VideoShader の走査線が見つからない（平均の明るさを保たない）`),r=a;let o=r.replace(`// 10. DCT ブロックの気配`,`// 検証ステージ: 元の色を残す（Film.colorKeep）。輝度は VHS の処理のまま、色差を元の映像の色差へ戻す
      if (colorKeep > 0.0) {
        float yk = dot(rgb, LUMA);
        // 黒浮きで明るくなった暗部は、明るくなった分だけ色差も増やす（暗い青緑が灰色の膜にならないように。最大 1.5 倍）
        float lift = clamp(yk / max(y, 0.02), 1.0, 1.5);
        vec2 ck = mix(vec2(dot(rgb, CB), dot(rgb, CR)), cc * mix(1.0, lift, 0.7), colorKeep);
        rgb = vec3(yk + 1.402 * ck.y, yk - 0.344136 * ck.x - 0.714136 * ck.y, yk + 1.772 * ck.x);
      }
      // 10. DCT ブロックの気配`);o===r?t===`singleMaterial`&&console.warn(`[Film] VideoShader の色段が見つからない（元の色を残す は効かない）`):(r=o.replace(`uniform float smear;`,`uniform float smear;
uniform float colorKeep;`),n.uniforms.colorKeep=this.colorKeepU),r!==n.fragmentShader&&(n.fragmentShader=r,n.needsUpdate=!0)}}setSize(e,t){for(let n of[this.rtLinear,this.rtLens,this.rtDisplay])n.setSize(e,t);this.lens.setSize(e,t),this.video.setSize(e,t),this.encode.material.uniforms.uRes.value.set(e,t)}setDepthTexture(e){this.lens.setDepthTexture(e)}snap(e,t,n){this.rig.baseFov=e.fov,this.rig.snap(this.subject(0,new y,t,n,1.6,!0,!1,0)),this.hasLast=!1}updateCamera(e,t){let n=this.hasLast?Math.hypot(t.pos.x-this.lastPos.x,t.pos.z-this.lastPos.z):0,r=e>0?n/e:0,i=this.hasLast&&(Math.abs(t.yaw-this.lastYaw)+Math.abs(t.pitch-this.lastPitch))/Math.max(e,.001)>.05;this.stillSec=r<.05&&!i?this.stillSec+e:0;let a=r>2.4?1.1:.75;for(this.strideAcc+=n;this.strideAcc>=a;)this.strideAcc-=a,this.strideCount++;this.hasLast&&e>0&&this.lens.setCameraMotion((t.yaw-this.lastYaw)/e,(t.pitch-this.lastPitch)/e),this.lastPos.copy(t.pos),this.lastYaw=t.yaw,this.lastPitch=t.pitch,this.hasLast=!0,this.video.setStillness(this.stillSec),this.video.setAudioNoise(.2),this.active&&(this.rig.update(e,this.subject(r,t.pos,t.yaw,t.pitch,t.eye,t.onGround,t.crouching,a)),this.rig.camera.updateMatrixWorld())}subject(e,t,n,r,i,a,o,s){return{pos:[t.x,t.y,t.z],eye:i,yaw:n,pitch:r,onGround:a,crouching:o,moveRank:e<.1?`still`:s>1?`dash`:`walk`,strideAcc:this.strideAcc,strideCount:this.strideCount,horizontalSpeed:e,stillSec:this.stillSec}}update(e){this.frame++,this.lens.update(e,this.frame),this.video.update(e,this.frame),this.rec.update(e)}render(e){this.lens.render(e,this.rtLens,this.rtLinear);let t=this.encode.material;t.uniforms.tSrc.value=this.rtLens.texture,t.uniforms.uScale.value=this.inputScale,e.setRenderTarget(this.rtDisplay),this.encode.render(e),this.video.render(e,this.rtLens,this.rtDisplay)}freezeNoise(e){this.video.frozenSeed=e}dispose(){this.lens.dispose(),this.video.dispose(),this.rec.dispose(),this.rtLinear.dispose(),this.rtLens.dispose(),this.rtDisplay.dispose(),this.encode.dispose()}};function co(){try{let e=localStorage.getItem(ao);return e?JSON.parse(e):{}}catch{return{}}}function lo(e){try{localStorage.setItem(ao,JSON.stringify(e))}catch{}}var uo=1456,fo=class{container;scenes;renderer;camera=new W(60,uo/816,.05,1200);input;player;colliders=new ai;post;film;scene=new xe;lamps=new Fi;def=null;built=null;view=null;style;sun=null;variant=`v1`;letterbox=!0;frozen=!1;time=0;fps=0;last=performance.now();frames=0;fpsT=0;pixelRatio=Math.min(window.devicePixelRatio,1.5);fixedSize=null;onChange=null;defs=new Map;loading=!1;constructor(e,t,n={}){this.container=e,this.scenes=t,this.renderer=new ii({antialias:!1,powerPreference:`high-performance`,preserveDrawingBuffer:!1}),this.renderer.outputColorSpace=ae,this.renderer.toneMapping=0,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=1,this.renderer.autoClear=!1,this.renderer.info.autoReset=!1,e.appendChild(this.renderer.domElement),this.input=new oi(this.renderer.domElement),this.player=new hi(this.camera),this.camera.layers.enable(1),this.post=new Mi(this.renderer);let r=document.createElement(`div`);r.className=`film-frame`,e.appendChild(r),this.film=new so(this.scene,this.camera,r,n.persistFilm??!0),this.post.setFilm(this.film),this.film.onChange=()=>{this.film.active||(this.camera.fov=this.film.rig.baseFov,this.camera.updateProjectionMatrix()),this.onChange?.()},window.addEventListener(`resize`,()=>this.resize())}async getDef(e){let t=this.scenes.find(t=>t.id===e)??this.scenes[0],n=this.defs.get(t.id);return n||(n=await t.load(),this.defs.set(t.id,n)),n}async load(e,t){this.loading=!0;let n;try{n=await this.getDef(e)}finally{this.loading=!1}this.unload(),this.def=n,this.style=n.style,Ce(this.style),this.post.style=this.style,this.scene.clear(),this.colliders.clear(),this.lamps.clear(),this.sun=null;let r={style:n.style,renderer:this.renderer,colliders:this.colliders,mat:e=>Li(n.style,e),addReflector:(e,t,n)=>{let r=new gi(e,t,n);return r.setSize(this.post.width,this.post.height),this.post.reflectors.push(r),r},setSun:e=>this.sun=e,updateShadows:()=>this.renderer.shadowMap.needsUpdate=!0,addLamp:e=>this.lamps.add(e)};this.renderer.shadowMap.autoUpdate=!0,this.built=n.build(r),this.built.staticShadows&&(this.renderer.shadowMap.autoUpdate=!1),this.scene.add(this.built.root),n.sky!==!1&&this.scene.add(Ui(n.sky??{})),this.renderer.shadowMap.needsUpdate=!0;let i=this.built.spawn;this.player.setSpawn({x:i.pos[0],y:i.pos[1],z:i.pos[2]},i.yaw,i.pitch??0),this.camera.fov=n.views[0]?.fov??60,this.camera.updateProjectionMatrix(),this.film.snap(this.camera,this.player.yaw,this.player.pitch),this.view=null;let a=t===void 0?n.views[0]?.id:t;a?this.setView(a):this.player.applyCamera(),this.resize(),this.onChange?.()}unload(){this.built?.dispose?.();for(let e of this.post.reflectors)e.dispose();this.post.reflectors.length=0,this.scene.traverse(e=>{let t=e;if(t.isMesh){t.geometry.dispose();let e=Array.isArray(t.material)?t.material:[t.material];for(let t of e){for(let e of Object.values(t))e instanceof j&&e.dispose();t.dispose()}}}),this.built=null}setView(e){if(!this.def)return;let t=e?this.def.views.find(t=>t.id===e):void 0;this.view=t??null,this.setStyle(t?.style??this.def.style),t&&(this.camera.fov=t.fov,this.camera.updateProjectionMatrix(),this.player.placeEye({x:t.eye[0],y:t.eye[1],z:t.eye[2]},t.yaw,t.pitch,t.roll??0,this.colliders),this.player.applyCamera(),this.film.snap(this.camera,t.yaw,t.pitch),this.onChange?.())}setStyle(e){this.style=e,Ce(e),this.post.style=e}resize(){let e,t,n=window.innerWidth,r=window.innerHeight;if(this.fixedSize)[e,t]=this.fixedSize;else if(this.letterbox){let i=uo/816;n/r>i?(t=r,e=Math.round(r*i)):(e=n,t=Math.round(n/i))}else e=n,t=r;let i=this.fixedSize?1:this.pixelRatio;this.renderer.setPixelRatio(i),this.renderer.setSize(e,t);let a=this.renderer.domElement;a.style.left=`${Math.round((n-e)/2)}px`,a.style.top=`${Math.round((r-t)/2)}px`,this.container.style.setProperty(`--vw`,`${e}px`),this.container.style.setProperty(`--vh`,`${t}px`),this.container.style.setProperty(`--vx`,`${Math.round((n-e)/2)}px`),this.container.style.setProperty(`--vy`,`${Math.round((r-t)/2)}px`),this.camera.aspect=e/t,this.camera.updateProjectionMatrix(),this.post.setSize(Math.round(e*i),Math.round(t*i))}start(){let e=()=>{requestAnimationFrame(e);let t=performance.now(),n=Math.min((t-this.last)/1e3,.1);this.last=t,this.step(n),this.frames++,this.fpsT+=n,this.fpsT>.5&&(this.fps=this.frames/this.fpsT,this.frames=0,this.fpsT=0)};requestAnimationFrame(e)}step(e){this.frozen||(this.time+=e),z.uTime.value=this.time;let t=this.player.pos.clone();this.player.externalCamera=this.film.active,this.player.update(e,this.input,this.colliders),this.view&&t.distanceToSquared(this.player.pos)>1e-6&&(this.view=null,this.onChange?.()),this.input.endFrame();let n=this.player;this.film.updateCamera(e,{pos:n.pos,yaw:n.yaw,pitch:n.pitch,eye:n.eyeHeight,onGround:n.onGround,crouching:n.height<1.5}),this.film.update(e),this.built?.update?.(e,this.time,this.camera),this.applyZoneStyle(),this.renderFrame()}applyZoneStyle(){let e=this.built?.styleZones;if(!e)return;let t=this.camera.position,n=e.find(e=>t.x>=e.min[0]&&t.x<=e.max[0]&&t.y>=e.min[1]&&t.y<=e.max[1]&&t.z>=e.min[2]&&t.z<=e.max[2]);n&&n.style!==this.style&&this.setStyle(n.style)}renderFrame(){this.built?.beforeRender?.(this.camera),this.lamps.update(this.camera.position),this.sun&&(z.uSunShadowMatrix.value.copy(this.sun.shadow.matrix),z.uSunShadowNormalBias.value=this.sun.shadow.normalBias),this.camera.updateMatrixWorld(),this.renderer.info.reset(),this.post.render(this.scene,this.camera),this.sun&&z.uSunShadowMatrix.value.copy(this.sun.shadow.matrix)}async topDownMap(t=2.2,n=1400,r=!0){let i=new ye;this.scene.traverse(e=>{let t=e;if(!t.isMesh||e.name===`sky`||!t.visible)return;let n=new ye().setFromObject(t);Number.isFinite(n.min.x)&&n.max.x-n.min.x<300&&n.max.z-n.min.z<300&&i.union(n)});for(let e of this.def?.views??[])i.expandByPoint(new y(...e.eye));let a=i.min.x-2,o=i.max.x+2,s=i.min.z-2,c=i.max.z+2,l=o-a,u=c-s,d=l>=u?n:Math.round(n*l/u),f=l>=u?Math.round(n*u/l):n,p=new V(a,o,-s,-c,.1,4e3);p.position.set(0,i.max.y+50,0),p.up.set(0,0,-1),p.lookAt(0,0,0),p.updateMatrixWorld();let h=this.renderer,g=h.getSize(new m),_=h.getPixelRatio();h.setPixelRatio(1),h.setSize(d,f,!1),h.clippingPlanes=[new Se(new y(0,-1,0),t)];let v=this.scene.getObjectByName(`sky`);v&&(v.visible=!1),this.built?.beforeRender?.(p,{map:!0});let b=z.uFogParams.value.x;z.uFogParams.value.x=0,h.setRenderTarget(null),h.setClearColor(1053720,1),h.clear(),h.render(this.scene,p),z.uFogParams.value.x=b,this.built?.beforeRender?.(this.camera);let x=h.domElement.toDataURL(`image/png`);if(v&&(v.visible=!0),h.clippingPlanes=[],h.setPixelRatio(_),h.setSize(g.x,g.y,!1),this.resize(),!r)return{image:x,bounds:[a,s,o,c]};let S=await po(x),C=document.createElement(`canvas`);C.width=d,C.height=f;let w=C.getContext(`2d`);w.drawImage(S,0,0);let T=(e,t)=>[(e-a)/l*d,(t-s)/u*f];w.lineWidth=2,w.font=`bold 14px sans-serif`;for(let t of this.def?.views??[]){let[n,r]=T(t.eye[0],t.eye[2]),i=Math.atan(Math.tan(e.degToRad(t.fov)/2)*(uo/816)),a=Math.min(d,f)*.12;w.strokeStyle=`#ffcc33`,w.fillStyle=`rgba(255, 204, 51, 0.2)`,w.beginPath(),w.moveTo(n,r);for(let e of[-1,1]){let o=t.yaw+e*i;w.lineTo(n-Math.sin(o)*a,r-Math.cos(o)*a)}w.closePath(),w.fill(),w.stroke(),w.fillStyle=`#ffcc33`,w.fillText(t.id,n+6,r-6)}return w.fillStyle=`#ffffff`,w.fillText(`${l.toFixed(0)} × ${u.toFixed(0)} m（上が奥 -Z）・高さ ${t} m より上を切り取り`,10,f-10),{image:C.toDataURL(`image/png`),bounds:[a,s,o,c]}}async planImage(e={}){let t=this.def?.plan;if(!t)return null;let n=(this.def?.views??[]).map(e=>({id:e.id,eye:e.eye,yaw:e.yaw,fov:e.fov,reach:this.viewFan(e.eye,e.yaw,e.fov)})),r=document.createElement(`canvas`);if(e.top){let i=await this.topDownMap(e.cut??2.2,1600,!1),a=await po(i.image);qi(t,r,{level:e.level,views:n,under:{image:a,bounds:i.bounds},bounds:i.bounds,px:1600})}else qi(t,r,{level:e.level,views:n});return r.toDataURL(`image/png`)}reach(e=.3,t=1/0){let n=this.colliders.boxes.filter(e=>e.passable),r=n.map(e=>e.enabled);for(let e of n)e.enabled=!1;try{return this.reachInner(e,t)}finally{n.forEach((e,t)=>e.enabled=r[t])}}reachInner(e,t){let n=this.colliders,r=.26,i=.36,a=1.12,o=this.built?.spawn.pos??[0,0,0],s=n.groundBelow(o[0],o[2],r,o[1]+i),c=[o[0],Number.isFinite(s.y)?s.y:o[1],o[2]],l=(t,n,r)=>`${Math.round(t/e)},${Math.round(n/e)},${Math.round(r*5)}`,u=new Set([l(...c)]),d=[c],f=[c],p=new y;for(;f.length&&u.size<15e5;){let[o,s,c]=f.pop();for(let[m,h]of[[e,0],[-e,0],[0,e],[0,-e]]){let e=o+m,g=c+h,_=n.groundBelow(e,g,r,s+i);if(!Number.isFinite(_.y)||_.y<s-4||_.depth>t||(p.set(e,_.y,g),n.pushOut(p,r,_.y+i,_.y+a),Math.hypot(p.x-e,p.z-g)>.05)||_.y<s-i&&(p.set(e,s,g),n.pushOut(p,r,s+i,s+a),Math.hypot(p.x-e,p.z-g)>.05)||n.ceilingAbove(e,g,r,_.y+.3)<_.y+a)continue;let v=l(e,g,_.y);if(u.has(v))continue;u.add(v);let y=[e,_.y,g];d.push(y),f.push(y)}}let m=e=>{let t=n.groundBelow(e[0],e[2],r,e[1]-.3),i=Number.isFinite(t.y)?t.y:e[1]-1.6;return d.some(t=>Math.abs(t[1]-i)<.25&&Math.hypot(t[0]-e[0],t[2]-e[2])<.45)},h={};for(let e of this.def?.views??[])h[e.id]=m(e.eye);let g={};for(let e of this.def?.plan?.tour??[])g[e.label]=m(e.eye);return{views:h,tour:g,cells:u.size,points:d}}viewFan(t,n,r,i=48,a=80){let o=Math.atan(Math.tan(e.degToRad(r)/2)*(uo/816)),s=[];for(let e=0;e<=i;e++){let r=n-o+2*o*e/i;s.push(this.colliders.rayXZ(t[0],t[2],t[1],-Math.sin(r),-Math.cos(r),a))}return s}async shotAt(e,t,n=0,r=60,i=2){if(this.view=null,this.def&&this.setStyle(this.def.style),this.camera.fov=r,this.camera.updateProjectionMatrix(),this.player.placeEye({x:e[0],y:e[1],z:e[2]},t,n,0),this.player.applyCamera(),this.applyZoneStyle(),i>0&&this.built?.update)for(let e=0;e<i;e+=.1)this.built.update(.1,this.time+e,this.camera);this.frozen=!0,this.fixedSize=[uo,816],this.resize(),this.film.snap(this.camera,t,n);for(let e=0;e<3;e++)this.renderFrame();let a=await po(this.renderer.domElement.toDataURL(`image/png`));return this.fixedSize=null,this.resize(),a}async tourPerf(e=40){let t=[];for(let n of this.def?.plan?.tour??[]){await this.shotAt(n.eye,n.yaw,n.pitch??0,n.fov??60);let r=this.perf(e);t.push({label:n.label,ms:r.ms,calls:r.calls})}return t}async tourSheet(e=3){let t=this.def?.plan?.tour;return t?.length?this.stopsSheet(t,e):null}randomStops(e=18,t=1){let n=ra(t),r=this.reach().points,i=(this.def?.plan?.spaces??[]).filter(e=>e.kind!==`void`),a=(e,t,n)=>{let r=!1;for(let i=0,a=n.length-1;i<n.length;a=i++){let[o,s]=n[i],[c,l]=n[a];s>t!=l>t&&e<(c-o)*(t-s)/(l-s)+o&&(r=!r)}return r},o=i.map(e=>Wi(e)),s=new Map;for(let e=0;e<r.length;e+=3){let[t,n,c]=r[e],l=-1;for(let e=0;e<i.length;e++){let r=i[e];if(!(n<r.floor-.7||r.ceiling!==void 0&&n>r.ceiling)&&a(t,c,o[e])){l=e;break}}let u=s.get(l)??[];u.push(r[e]),s.set(l,u)}let c=[...s.keys()];for(let e=c.length-1;e>0;e--){let t=Math.floor(n()*(e+1));[c[e],c[t]]=[c[t],c[e]]}let l=[],u=this.colliders.boxes.filter(e=>e.passable),d=(e,t)=>u.some(n=>Math.max(n.min.x-e,0,e-n.max.x)**2+Math.max(n.min.z-t,0,t-n.max.z)**2<.81),f=(e,t,n)=>{let r=0;for(let i=0;i<12;i++){let a=i/12*Math.PI*2;this.colliders.rayXZ(e,n,t,-Math.sin(a),-Math.cos(a),1.5)>=1.5&&r++}return r<4};for(let t=0;t<e&&c.length;t++){let e=c[t%c.length],r=s.get(e),[a,o,u]=r[Math.floor(n()*r.length)];for(let e=0;e<12&&(d(a,u)||f(a,o+1.6,u));e++)[a,o,u]=r[Math.floor(n()*r.length)];let p=o+1.6,m=[];for(let e=0;e<16;e++){let t=e/16*Math.PI*2+n()*.3,r=this.colliders.rayXZ(a,u,p,-Math.sin(t),-Math.cos(t),30);r>=2.5&&m.push([t,Math.min(r,20)**2])}let h=n()*Math.PI*2;if(m.length){let e=n()*m.reduce((e,t)=>e+t[1],0);for(let t of m)if(e-=t[1],e<=0){h=t[0];break}}let g=e>=0?i[e].label:`間取り図の外`;l.push({label:`無作為 ${t+1}: ${g}`,eye:[a,p,u],yaw:h,pitch:(n()-.5)*.16-.02,fov:60})}return l}palCache=null;async refPalette(){let e=this.def;if(this.palCache?.id===e.id)return this.palCache.pal;let t=[];for(let n of e.views)t.push(Qi(await po(`refs/${n.id}.jpg`)));let n=ta(t);return this.palCache={id:e.id,pal:n},n}async shotStats(e,t,n=0,r=60){let i=await this.refPalette(),a=await this.shotAt(e,t,n,r);return{src:a.src,stats:na(Qi(a),i)}}async stopsSheet(e,t=3,n,r){let i=Math.round(uo/t),a=Math.round(i*816/uo),o=Math.ceil(e.length/t),s=document.createElement(`canvas`);s.width=i*t,s.height=o*(a+20);let c=s.getContext(`2d`);c.fillStyle=`#101416`,c.fillRect(0,0,s.width,s.height);for(let o=0;o<e.length;o++){let s=e[o],l=await this.shotAt(s.eye,s.yaw,s.pitch??0,s.fov??60);n&&n.push(na(Qi(l),r));let u=o%t*i,d=Math.floor(o/t)*(a+20);c.fillStyle=`#e8efec`,c.font=`13px sans-serif`,c.fillText(`${o+1}. ${s.label}`,u+6,d+15),c.drawImage(l,u,d+20,i,a)}return s.toDataURL(`image/jpeg`,.86)}async qualityReport(e=18,t=1){let n=this.def,r=await this.refPalette(),i=[];for(let e of n.views)i.push({id:e.id,stats:na(Qi(await po(`refs/${e.id}.jpg`)),r)});let a=[];for(let e of n.views){let t=await this.capture(e.id);a.push({id:e.id,stats:na(Qi(await po(t.render)),r)})}let o=n.plan?.tour??[],s=[],c=o.length?await this.stopsSheet(o,3,s,r):null,l=this.randomStops(e,t),u=[],d=await this.stopsSheet(l,3,u,r);return{refs:i,views:a,tour:o.map((e,t)=>({label:e.label,stats:s[t]})),random:l.map((e,t)=>({label:e.label,stats:u[t]})),tourSheet:c,randomSheet:d}}perf(e=90){this.fixedSize=[uo,816],this.resize();let t=this.renderer.getContext(),n=new Uint8Array(4),r=()=>t.readPixels(0,0,1,1,t.RGBA,t.UNSIGNED_BYTE,n);this.renderFrame(),r();let i=performance.now();for(let t=0;t<e;t++)this.time+=1/60,z.uTime.value=this.time,this.renderFrame(),r();let a=(performance.now()-i)/e,{calls:o,triangles:s}=this.renderer.info.render;return this.fixedSize=null,this.resize(),{ms:Math.round(a*100)/100,calls:o,triangles:s}}async capture(e,t=4,n=3){if(e){let t=e.replace(/-\d+$/,``);this.def?.id!==t&&this.scenes.some(e=>e.id===t)?await this.load(t,e):this.setView(e)}let r=this.frozen;this.frozen=!0,this.player.bob=0,this.fixedSize=[uo,816],this.resize(),this.film.freezeNoise(7),this.film.active&&this.film.update(1/60);for(let e=0;e<3;e++)this.renderFrame();this.film.freezeNoise(null);let i=this.renderer.domElement.toDataURL(`image/png`),a=await po(i),o=``,s=``,c=``,l={},u=e??this.view?.id,d=u?await po(`refs/${u}.jpg`).catch(()=>null):null;if(d){let e=document.createElement(`canvas`);e.width=uo,e.height=408;let r=e.getContext(`2d`);r.drawImage(a,0,0,uo/2,408),r.drawImage(d,uo/2,0,uo/2,408),r.fillStyle=`rgba(0,0,0,0.6)`,r.fillRect(0,0,70,18),r.fillRect(uo/2,0,70,18),r.fillStyle=`#fff`,r.font=`12px sans-serif`,r.fillText(`render`,6,13),r.fillText(`reference`,734,13),o=e.toDataURL(`image/png`),l=_o(a,d,t,n),s=mo(a,d);let i=ho(a,d);c=i.image,Object.assign(l,{edgeF:i.f,edgeP:i.p,edgeR:i.r})}return this.fixedSize=null,this.frozen=r,this.resize(),{render:i,compare:o,diff:s,edges:c,metrics:l}}};function po(e){return new Promise((t,n)=>{let r=new Image;r.onload=()=>t(r),r.onerror=n,r.src=e})}function mo(e,t){let n=uo/2,r=e=>{let t=document.createElement(`canvas`);t.width=n,t.height=408;let r=t.getContext(`2d`);return r.drawImage(e,0,0,n,408),r.getImageData(0,0,n,408).data},i=r(e),a=r(t),o=document.createElement(`canvas`);o.width=n,o.height=408;let s=o.getContext(`2d`),c=s.createImageData(n,408),l=(e,t)=>{let n=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4};return go(n(e[t]),n(e[t+1]),n(e[t+2]))};for(let e=0;e<n*408*4;e+=4){let t=l(i,e),n=l(a,e),r=(t[0]-n[0])*6,o=Math.hypot(t[1]-n[1],t[2]-n[2])*12,s=(a[e]+a[e+1]+a[e+2])/3*.25;c.data[e]=Math.min(255,s+Math.max(0,r)*255),c.data[e+1]=Math.min(255,s+Math.min(1,o)*200),c.data[e+2]=Math.min(255,s+Math.max(0,-r)*255),c.data[e+3]=255}return s.putImageData(c,0,0),o.toDataURL(`image/png`)}function ho(e,t){let n=uo/2,r=e=>{let t=document.createElement(`canvas`);t.width=n,t.height=408;let r=t.getContext(`2d`);r.imageSmoothingQuality=`high`,r.drawImage(e,0,0,n,408);let i=r.getImageData(0,0,n,408).data,a=new Float32Array(n*408);for(let e=0;e<n*408;e++)a[e]=(.2126*i[e*4]+.7152*i[e*4+1]+.0722*i[e*4+2])/255;return a},i=e=>{let t=new Float32Array(n*408);for(let r=1;r<407;r++)for(let i=1;i<727;i++){let a=r*n+i,o=e[a-n+1]+2*e[a+1]+e[a+n+1]-e[a-n-1]-2*e[a-1]-e[a+n-1],s=e[a+n-1]+2*e[a+n]+e[a+n+1]-e[a-n-1]-2*e[a-n]-e[a-n+1];t[a]=Math.hypot(o,s)}let r=[];for(let e=0;e<t.length;e+=7)r.push(t[e]);r.sort((e,t)=>e-t);let i=Math.max(.12,r[Math.floor(r.length*.92)]),a=new Uint8Array(n*408);for(let e=0;e<t.length;e++)a[e]=+(t[e]>i);return a},a=(e,t)=>{let r=new Uint8Array(n*408);for(let i=0;i<408;i++)for(let a=0;a<n;a++){let o=0;for(let r=-t;r<=t&&!o;r++){let t=a+r;t>=0&&t<n&&(o=e[i*n+t])}r[i*n+a]=o}let i=new Uint8Array(n*408);for(let e=0;e<408;e++)for(let a=0;a<n;a++){let o=0;for(let i=-t;i<=t&&!o;i++){let t=e+i;t>=0&&t<408&&(o=r[t*n+a])}i[e*n+a]=o}return i},o=r(e),s=r(t),c=i(o),l=i(s),u=a(c,3),d=a(l,3),f=0,p=0,m=0,h=0;for(let e=0;e<n*408;e++)c[e]&&(f++,d[e]&&m++),l[e]&&(p++,u[e]&&h++);let g=f?m/f:0,_=p?h/p:0,v=g+_>0?2*g*_/(g+_):0,y=document.createElement(`canvas`);y.width=n,y.height=408;let b=y.getContext(`2d`),x=b.createImageData(n,408);for(let e=0;e<n*408;e++){let t=s[e]*70,n=c[e],r=l[e];x.data[e*4]=n&&r||r?255:n?60:t,x.data[e*4+1]=n&&r?255:r?70:n?220:t,x.data[e*4+2]=n&&r?255:r?60:n?255:t,x.data[e*4+3]=255}b.putImageData(x,0,0);let S=e=>Math.round(e*1e3)/10;return{f:S(v),p:S(g),r:S(_),image:y.toDataURL(`image/png`)}}function go(e,t,n){let r=Math.cbrt(.4122214708*e+.5363325363*t+.0514459929*n),i=Math.cbrt(.2119034982*e+.6806995451*t+.1073969566*n),a=Math.cbrt(.0883024619*e+.2817188376*t+.6299787005*n);return[.2104542553*r+.793617785*i-.0040720468*a,1.9779984951*r-2.428592205*i+.4505937099*a,.0259040371*r+.7827607001*i-.808675766*a]}function _o(e,t,n=4,r=3){let i=e=>{let t=document.createElement(`canvas`);t.width=182,t.height=102;let n=t.getContext(`2d`);n.imageSmoothingQuality=`high`,n.drawImage(e,0,0,182,102);let r=n.getImageData(0,0,182,102).data,i=new Float32Array(55692);for(let e=0;e<18564;e++){let t=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},n=t(r[e*4]),a=t(r[e*4+1]),o=t(r[e*4+2]),s=Math.cbrt(.4122214708*n+.5363325363*a+.0514459929*o),c=Math.cbrt(.2119034982*n+.6806995451*a+.1073969566*o),l=Math.cbrt(.0883024619*n+.2817188376*a+.6299787005*o);i[e*3]=.2104542553*s+.793617785*c-.0040720468*l,i[e*3+1]=1.9779984951*s-2.428592205*c+.4505937099*l,i[e*3+2]=.0259040371*s+.7827607001*c-.808675766*l}return i},a=i(e),o=i(t),s=0,c=0,l=0,u=0,d=Array(n*r).fill(0),f=Array(n*r).fill(0),p=Array(n*r).fill(0);for(let e=0;e<102;e++)for(let t=0;t<182;t++){let i=(e*182+t)*3,m=Math.hypot(a[i]-o[i],a[i+1]-o[i+1],a[i+2]-o[i+2]);s+=m,c+=a[i]-o[i],l+=Math.hypot(a[i+1],a[i+2]),u+=Math.hypot(o[i+1],o[i+2]);let h=Math.min(r-1,Math.floor(e/102*r))*n+Math.min(n-1,Math.floor(t/182*n));d[h]+=m,f[h]+=a[i]-o[i],p[h]++}let m=18564,h=e=>Math.round(e*1e3)/10;return{dE:h(s/m),dL:h(c/m),chromaRender:h(l/m),chromaRef:h(u/m),gridDE:d.map((e,t)=>h(e/p[t])),gridDL:f.map((e,t)=>h(e/p[t]))}}var vo=`modulepreload`,yo=function(e){return`/pl-vs/lab/`+e},bo={},xo=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=yo(t,n),t=s(t),t in bo)return;bo[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:vo,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},So=[{id:`corridor`,label:`病院の病棟（建築版）`,load:async()=>(await xo(async()=>{let{corridor:e}=await import(`./corridor-BjNrCbiN.js`);return{corridor:e}},__vite__mapDeps([0,1,2,3,4,5]))).corridor},{id:`station`,label:`霧の駅（建築版）`,load:async()=>(await xo(async()=>{let{station:e}=await import(`./station-Dh5NO2o4.js`);return{station:e}},__vite__mapDeps([6,1,2,7]))).station},{id:`pool`,label:`屋内プール（建築版）`,load:async()=>(await xo(async()=>{let{pool:e}=await import(`./pool-B8U4rl5_.js`);return{pool:e}},__vite__mapDeps([8,1,2,4,7,9]))).pool},{id:`alley`,label:`校舎の間の通路（建築版）`,load:async()=>(await xo(async()=>{let{alley:e}=await import(`./alley-DWo0OIqr.js`);return{alley:e}},__vite__mapDeps([10,1,2,3,11,12]))).alley},{id:`pastel`,label:`淡色の廊下（建築版）`,load:async()=>(await xo(async()=>{let{pastel:e}=await import(`./pastel-mhTijeDi.js`);return{pastel:e}},__vite__mapDeps([13,1,2,3,11,4,7]))).pastel}],Co=[{id:`station`,label:`霧の駅`,load:async()=>(await xo(async()=>{let{station:e}=await import(`./station-CC6e_dHg.js`);return{station:e}},__vite__mapDeps([14,1,2]))).station},{id:`pool`,label:`屋内プール`,load:async()=>(await xo(async()=>{let{pool:e}=await import(`./pool-DXng4CRa.js`);return{pool:e}},__vite__mapDeps([15,1,2,9]))).pool},{id:`corridor`,label:`病院の廊下`,load:async()=>(await xo(async()=>{let{corridor:e}=await import(`./corridor-CkaOt3Xz.js`);return{corridor:e}},__vite__mapDeps([16,1,2,4,5,3]))).corridor},{id:`pastel`,label:`淡色の廊下`,load:async()=>(await xo(async()=>{let{pastel:e}=await import(`./pastel-DyU0Crj8.js`);return{pastel:e}},__vite__mapDeps([17,1,2,11]))).pastel},{id:`alley`,label:`校舎の間の通路`,load:async()=>(await xo(async()=>{let{alley:e}=await import(`./alley-BJHSVtvR.js`);return{alley:e}},__vite__mapDeps([18,1,2,11,12]))).alley},{id:`test`,label:`基盤の確認`,load:async()=>(await xo(async()=>{let{test:e}=await import(`./test-XpdyUxcx.js`);return{test:e}},__vite__mapDeps([19,1,2]))).test}],wo={off:`オフ`,clean:`クリーン`,homeVideo:`ホームビデオ`,tape:`テープ（走査線・揺れ）`},To=class{film;el;preset;vhs;vhsOut;keep;keepOut;handheld;handheldOut;lag;hold;rec;ae;awb;constructor(e,t){this.film=e,this.el=document.createElement(`details`),this.el.className=`film`,this.el.open=!0,this.el.innerHTML=`
      <summary>カメラ効果（VHS）</summary>
      <label>描画効果 <select data-f="preset"></select></label>
      <label>VHS 効果 <input data-f="vhs" type="range" min="0" max="2" step="0.05"><span data-o="vhs"></span></label>
      <label>元の色を残す <input data-f="keep" type="range" min="0" max="1" step="0.05"><span data-o="keep"></span></label>
      <label>手持ち感 <input data-f="handheld" type="range" min="0" max="1" step="0.05"><span data-o="handheld"></span></label>
      <label>表示 fps <select data-f="hold">
        <option value="off">プリセットに従う</option><option value="30">30 fps</option><option value="24">24 fps</option>
      </select></label>
      <div class="row">
        <label><input type="checkbox" data-f="lag">視線の遅れ</label>
        <label><input type="checkbox" data-f="rec">REC 表示</label>
        <label><input type="checkbox" data-f="ae">露出の追従</label>
        <label><input type="checkbox" data-f="awb">色の追従</label>
      </div>
      <div class="note">オフ以外で、手持ち感・視線の遅れ・REC も入る。露出・色の追従はゲーム向けの値なので、ここでは既定で切っている。「元の色を残す」は VHS の色調整で消える色を元の映像から戻す（走査線・揺れ・色のにじみ・ノイズは残る）</div>`,t.appendChild(this.el);let n=e=>this.el.querySelector(`[data-f="${e}"]`),r=e=>this.el.querySelector(`[data-o="${e}"]`);this.preset=n(`preset`),this.vhs=n(`vhs`),this.vhsOut=r(`vhs`),this.keep=n(`keep`),this.keepOut=r(`keep`),this.handheld=n(`handheld`),this.handheldOut=r(`handheld`),this.lag=n(`lag`),this.hold=n(`hold`),this.rec=n(`rec`),this.ae=n(`ae`),this.awb=n(`awb`);for(let e of Ta)this.preset.add(new Option(wo[e],e));let i=e=>e.target.blur();this.preset.onchange=t=>{e.set({preset:this.preset.value}),i(t)},this.vhs.oninput=()=>e.set({vhsStrength:Number(this.vhs.value)}),this.keep.oninput=()=>e.set({colorKeep:Number(this.keep.value)}),this.handheld.oninput=()=>e.set({handheld:Number(this.handheld.value)}),this.hold.onchange=t=>{e.set({frameHold:this.hold.value}),i(t)},this.lag.onchange=t=>{e.set({cameraLag:this.lag.checked}),i(t)},this.rec.onchange=t=>{e.set({rec:this.rec.checked}),i(t)},this.ae.onchange=t=>{e.set({autoExposure:this.ae.checked}),i(t)},this.awb.onchange=t=>{e.set({autoWhiteBalance:this.awb.checked}),i(t)};for(let e of[this.vhs,this.keep,this.handheld])e.addEventListener(`change`,i);window.addEventListener(`keydown`,t=>{let n=t.target;if(n.tagName!==`INPUT`&&n.tagName!==`SELECT`&&t.code===`KeyK`){let t=Ta.indexOf(e.settings.preset);e.set({preset:Ta[(t+1)%Ta.length]})}}),this.sync()}sync(){let e=this.film.settings;this.preset.value=e.preset,this.vhs.value=String(e.vhsStrength),this.vhsOut.textContent=e.vhsStrength<=0?`オフ`:`${Math.round(e.vhsStrength*100)}%`,this.keep.value=String(e.colorKeep),this.keepOut.textContent=e.colorKeep<=0?`オフ（ゲームと同じ）`:`${Math.round(e.colorKeep*100)}%`,this.handheld.value=String(e.handheld),this.handheldOut.textContent=e.handheld<=0?`オフ`:`${Math.round(e.handheld*100)}%`,this.hold.value=e.frameHold,this.lag.checked=e.cameraLag,this.rec.checked=e.rec,this.ae.checked=e.autoExposure,this.awb.checked=e.autoWhiteBalance;let t=e.preset===`off`;for(let e of[this.vhs,this.keep,this.handheld,this.hold,this.lag,this.rec,this.ae,this.awb])e.disabled=t}},Eo=[`off`,`overlay`,`swipe`,`diff`,`ref`],Do={off:`なし`,overlay:`重ねる`,swipe:`左右で切る`,diff:`差分`,ref:`参考画像だけ`},Oo=[`完成`,`後処理なし`,`法線`,`ID・線の重み`,`深度`,`線`],ko=class{app;el;refImg;sceneSel;viewSel;modeSel;opacity;debugSel;info;help;filmPanel;minimap;minimapOn=!1;mode=`off`;swipeX=.5;refId=``;constructor(e,t){this.app=e,this.refImg=document.createElement(`img`),this.refImg.className=`ref`,t.appendChild(this.refImg),this.el=document.createElement(`div`),this.el.className=`panel`,this.el.innerHTML=`
      <div class="title">見た目の検証ステージ</div>
      <div class="variant"></div>
      <label>場面 <select data-k="scene"></select></label>
      <label>視点 <select data-k="view"></select></label>
      <label>比較 <select data-k="mode"></select></label>
      <label>濃さ <input data-k="opacity" type="range" min="0" max="1" step="0.01" value="0.5"></label>
      <div class="row">
        <label><input type="checkbox" data-p="kuwahara" checked>クワハラ</label>
        <label><input type="checkbox" data-p="lines" checked>線</label>
        <label><input type="checkbox" data-p="bloom" checked>にじみ</label>
        <label><input type="checkbox" data-p="grade" checked>色調整</label>
      </div>
      <label>表示 <select data-k="debug"></select></label>
      <div class="info"></div>
      <button data-k="copy">カメラの値をコピー</button>`,t.appendChild(this.el);let n=e.variant===`arch`;this.el.querySelector(`.title`).textContent=n?`見た目の検証ステージ（建築版）`:`見た目の検証ステージ`,this.el.querySelector(`.variant`).innerHTML=n?`間取り図から作った版 ・ <a href="index.html">元の版へ</a> ・ M 間取り図`:`<a href="arch.html">建築版（間取り図から作った版）へ</a>`,this.minimap=document.createElement(`canvas`),this.minimap.className=`minimap`,t.appendChild(this.minimap),setInterval(()=>this.drawMinimap(),100),this.filmPanel=new To(e.film,this.el),this.help=document.createElement(`div`),this.help.className=`help`,this.help.innerHTML=`クリックで視点操作 ・ WASD 移動 ・ Shift 走る ・ C しゃがむ ・ Space ジャンプ ・ F 飛行<br>1〜6 場面 ・ [ ] 視点 ・ V 比較 ・ G 表示 ・ K カメラ効果 ・ L 画面いっぱい ・ R 視点に戻る ・ H 隠す`,t.appendChild(this.help);let r=e=>this.el.querySelector(`[data-k="${e}"]`);this.sceneSel=r(`scene`),this.viewSel=r(`view`),this.modeSel=r(`mode`),this.opacity=r(`opacity`),this.debugSel=r(`debug`),this.info=this.el.querySelector(`.info`);for(let t of e.scenes)this.sceneSel.add(new Option(t.label,t.id));for(let e of Eo)this.modeSel.add(new Option(Do[e],e));Oo.forEach((e,t)=>this.debugSel.add(new Option(e,String(t)))),this.sceneSel.onchange=()=>{e.load(this.sceneSel.value),this.sceneSel.blur()},this.viewSel.onchange=()=>{e.setView(this.viewSel.value||null),this.viewSel.blur()},this.modeSel.onchange=()=>{this.setMode(this.modeSel.value),this.modeSel.blur()},this.opacity.oninput=()=>this.updateRef(),this.debugSel.onchange=()=>{e.post.debug=Number(this.debugSel.value),this.debugSel.blur()},this.el.querySelectorAll(`[data-p]`).forEach(t=>{t.onchange=()=>{e.post.enable[t.dataset.p]=t.checked,t.blur()}}),r(`copy`).onclick=()=>{navigator.clipboard?.writeText(this.cameraText()),console.log(this.cameraText())},t.addEventListener(`mousemove`,t=>{if(this.mode!==`swipe`||e.input.locked)return;let n=e.renderer.domElement.getBoundingClientRect();this.swipeX=Math.min(1,Math.max(0,(t.clientX-n.left)/n.width)),this.updateRef()}),window.addEventListener(`keydown`,e=>this.key(e)),e.onChange=()=>this.sync(),this.sync(),setInterval(()=>this.tick(),250)}key(e){let t=e.target;if(t.tagName===`INPUT`||t.tagName===`SELECT`)return;let n=this.app,r=n.def?.views??[],i=r.findIndex(e=>e.id===(n.view?.id??this.refId));if(/^Digit[1-9]$/.test(e.code)){let t=n.scenes[Number(e.code.slice(5))-1];t&&n.load(t.id)}else if(e.code===`BracketRight`&&r.length)n.setView(r[(i+1)%r.length].id);else if(e.code===`BracketLeft`&&r.length)n.setView(r[(i-1+r.length)%r.length].id);else if(e.code===`KeyV`)this.setMode(Eo[(Eo.indexOf(this.mode)+1)%Eo.length]);else if(e.code===`KeyG`)n.post.debug=(n.post.debug+1)%Oo.length,this.debugSel.value=String(n.post.debug);else if(e.code===`KeyL`)n.letterbox=!n.letterbox,n.resize();else if(e.code===`KeyR`)this.refId?n.setView(this.refId):n.player.respawn();else if(e.code===`KeyM`)this.minimapOn=!this.minimapOn&&!!n.def?.plan,this.minimap.style.display=this.minimapOn?`block`:`none`;else if(e.code===`KeyH`){let e=this.el.style.display!==`none`;this.el.style.display=e?`none`:``,this.help.style.display=e?`none`:``}}setMode(e){this.mode=e,this.modeSel.value=e,this.updateRef()}sync(){let e=this.app;if(this.filmPanel?.sync(),e.def){this.sceneSel.value=e.def.id,this.viewSel.innerHTML=``,this.viewSel.add(new Option(`（自由に歩く）`,``));for(let t of e.def.views)this.viewSel.add(new Option(`${t.id}  ${t.label}`,t.id));e.view?this.refId=e.view.id:e.def.views.some(e=>e.id===this.refId)||(this.refId=e.def.views[0]?.id??``),this.viewSel.value=e.view?.id??``,this.updateRef()}}updateRef(){let e=this.refImg;if(this.mode===`off`||!this.refId){e.style.display=`none`;return}let t=`refs/${this.refId}.jpg`;e.src.endsWith(t)||(e.src=t),e.style.display=`block`,e.style.opacity=this.mode===`overlay`?this.opacity.value:`1`,e.style.mixBlendMode=this.mode===`diff`?`difference`:`normal`,e.style.clipPath=this.mode===`swipe`?`inset(0 0 0 ${(this.swipeX*100).toFixed(1)}%)`:`none`}drawMinimap(){let e=this.app.def?.plan;if(!this.minimapOn||!e){this.minimapOn&&!e&&(this.minimap.style.display=`none`);return}let t=this.app.player;qi(e,this.minimap,{compact:!0,px:340,views:(this.app.def?.views??[]).map(e=>({id:e.id,eye:e.eye,yaw:e.yaw,fov:e.fov})),player:{x:t.pos.x,z:t.pos.z,yaw:t.yaw}})}cameraText(){let e=this.app.player,t=this.app.camera,n=e=>e.toFixed(3);return`eye: [${n(t.position.x)}, ${n(t.position.y)}, ${n(t.position.z)}], yaw: ${n(e.yaw)}, pitch: ${n(e.pitch)}, fov: ${t.fov.toFixed(1)}`}tick(){let e=this.app,t=e.renderer.info.render;this.info.textContent=`${e.fps.toFixed(0)} fps ・ 描画 ${t.calls} 回 ・ ${(t.triangles/1e3).toFixed(0)}k 三角形\n${this.cameraText()}\n比較: ${this.refId||`-`}${e.player.fly?` ・ 飛行中`:``}`}},Ao=new URLSearchParams(location.search),jo=document.getElementById(`app`),Mo=Ao.has(`capture`),No=/arch\.html$/.test(location.pathname),Po=No?So:Co,Fo=new fo(jo,Po,{persistFilm:!Mo});Fo.variant=No?`arch`:`v1`,Mo&&document.body.classList.add(`capture`);function Io(){let e={};return Fo.scene.traverse(t=>{let n=t.material;if(n)for(let t of Array.isArray(n)?n:[n])e[t.name||t.uuid.slice(0,8)]=t}),e}window.__lab={app:Fo,capture:(e,t,n)=>Fo.capture(e,t,n),ready:!1,mats:Io,setColors:(e,t)=>{let n=Io()[e];return n?(Ri(n,Fo.style,t),!0):!1}};var Lo=Ao.get(`view`),Ro=Ao.get(`scene`)??(Lo?Lo.replace(/-\d+$/,``):Po[0].id);function zo(){let e=Ao.get(`set`);if(e){for(let t of e.split(e.includes(`;`)?`;`:`,`)){let e=t.indexOf(`=`),n=t.slice(0,e),r=t.slice(e+1),i=n.split(`.`),a=Fo.style;for(let e of i.slice(0,-1))a=a[e];let o=/^[[{]/.test(r)?JSON.parse(r):r===`true`?!0:r===`false`?!1:Number.isNaN(Number(r))?r:Number(r);a[i[i.length-1]]=o}Fo.setStyle(Fo.style)}Ao.get(`debug`)&&(Fo.post.debug=Number(Ao.get(`debug`)));let t=Ao.get(`film`);t&&Fo.film.set({preset:t,...Ao.get(`vhs`)?{vhsStrength:Number(Ao.get(`vhs`))}:{},...Ao.get(`keep`)?{colorKeep:Number(Ao.get(`keep`))}:{},...Ao.get(`handheld`)?{handheld:Number(Ao.get(`handheld`))}:{},...Ao.get(`hold`)?{frameHold:Ao.get(`hold`)}:{},...Ao.get(`ae`)?{autoExposure:Ao.get(`ae`)===`1`}:{},...Ao.get(`awb`)?{autoWhiteBalance:Ao.get(`awb`)===`1`}:{}},!1)}async function Bo(){await Fo.load(Ro,Lo??void 0),zo();let e=Mo?null:new ko(Fo,jo);e&&Ao.get(`compare`)&&e.setMode(Ao.get(`compare`)),Mo?(Fo.frozen=!0,Fo.player.bob=0,Fo.renderFrame()):Fo.start(),window.__lab.ready=!0}Bo().catch(e=>{console.error(e),window.__lab.error=String(e)});export{xi as a,Si as i,Ri as n,ai as o,Ni as r,Vi as t};