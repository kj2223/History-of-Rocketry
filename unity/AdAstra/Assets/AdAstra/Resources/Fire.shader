// Fire and the flash of a break-up: soft particles added on top of the picture.
Shader "AdAstra/Fire"
{
    Properties { _MainTex ("Glow", 2D) = "white" {} _Soft ("Soft distance", Float) = 0.8 }
    SubShader
    {
        Tags { "Queue" = "Transparent+1" "RenderType" = "Transparent" "IgnoreProjector" = "True" }
        ZWrite Off Cull Off Blend SrcAlpha One
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex; float _Soft;
            UNITY_DECLARE_DEPTH_TEXTURE(_CameraDepthTexture);
            struct appdata { float4 vertex : POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; };
            struct v2f { float4 pos : SV_POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; float4 proj : TEXCOORD1; };
            v2f vert (appdata v)
            {
                v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.color = v.color; o.uv = v.uv;
                o.proj = ComputeScreenPos(o.pos); COMPUTE_EYEDEPTH(o.proj.z); return o;
            }
            float4 frag (v2f i) : SV_Target
            {
                float scene = LinearEyeDepth(SAMPLE_DEPTH_TEXTURE_PROJ(_CameraDepthTexture, UNITY_PROJ_COORD(i.proj)));
                float fade = saturate((scene - i.proj.z) / _Soft);
                float4 t = tex2D(_MainTex, i.uv);
                return float4(t.rgb * i.color.rgb, t.a * i.color.a * fade);
            }
            ENDCG
        }
    }
}
