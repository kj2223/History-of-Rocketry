// Smoke and fire particles: soft-edged billboards that fade where they meet the ground instead of cutting a hard line
// through it (soft particles, from the world camera's depth texture). _Add 0 = smoke (alpha blended, lighting baked
// into the puff texture); the "Add" variant is the fire, added on top.
Shader "AdAstra/Smoke"
{
    Properties { _MainTex ("Puff", 2D) = "white" {} _Soft ("Soft distance", Float) = 1.5 }
    CGINCLUDE
    #include "UnityCG.cginc"
    sampler2D _MainTex; float _Soft;
    UNITY_DECLARE_DEPTH_TEXTURE(_CameraDepthTexture);
    struct appdata { float4 vertex : POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; };
    struct v2f { float4 pos : SV_POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; float4 proj : TEXCOORD1; UNITY_FOG_COORDS(2) };
    v2f vert (appdata v)
    {
        v2f o;
        o.pos = UnityObjectToClipPos(v.vertex);
        o.color = v.color; o.uv = v.uv;
        o.proj = ComputeScreenPos(o.pos);
        COMPUTE_EYEDEPTH(o.proj.z);
        UNITY_TRANSFER_FOG(o, o.pos);
        return o;
    }
    float SoftFade (v2f i)
    {
        float scene = LinearEyeDepth(SAMPLE_DEPTH_TEXTURE_PROJ(_CameraDepthTexture, UNITY_PROJ_COORD(i.proj)));
        return saturate((scene - i.proj.z) / _Soft);
    }
    ENDCG
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "IgnoreProjector" = "True" }
        ZWrite Off Cull Off
        Pass
        {
            Blend SrcAlpha OneMinusSrcAlpha
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            float4 frag (v2f i) : SV_Target
            {
                float4 t = tex2D(_MainTex, i.uv);
                float4 c = float4(t.rgb * i.color.rgb, t.a * i.color.a * SoftFade(i));
                UNITY_APPLY_FOG(i.fogCoord, c);
                return c;
            }
            ENDCG
        }
    }
}
