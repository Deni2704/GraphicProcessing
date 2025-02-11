#version 410 core

uniform bool fogEnabled;

in vec3 fPosition;
in vec3 fNormal;
in vec2 fTexCoords;

out vec4 fColor;

//matrices
uniform mat4 model;
uniform mat4 view;
uniform mat3 normalMatrix;
//lighting
uniform vec3 lightDir;
uniform vec3 lightColor;
// textures
uniform sampler2D diffuseTexture;
uniform sampler2D specularTexture;
uniform bool dirLightEnabled;
//components
vec3 totalAmbient = vec3(0.0);
vec3 totalDiffuse = vec3(0.0);
vec3 totalSpecular = vec3(0.0);

vec4 fPosEye;

struct PointLight {    
    vec3 position;
    
    float constant;
    float linear;
    float quadratic;  

    float ambientStrength;
    float specularStrength;
    vec3 color;
};  
#define NR_POINT_LIGHTS 7
uniform PointLight pointLight[NR_POINT_LIGHTS];
uniform bool pointLightEnabled; 


struct SpotLight {    
    vec3 position;
    vec3 direction;
    float constant;
    float linear;
    float quadratic;  

    float ambientStrength;
    float specularStrength;
    vec3 color;

    float inCutOff;
    float outCutOff;
};  
#define NR_SPOT_LIGHTS 2
uniform SpotLight spotLight[NR_SPOT_LIGHTS];
uniform bool spotLightEnabled; 

void computeDirLight()
{
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    //compute eye space coordinates
    fPosEye = view * model * vec4(fPosition, 1.0f);
    vec3 normalEye = normalize(normalMatrix * fNormal);

    //normalize light direction
    vec3 lightDirN = vec3(normalize(view * vec4(lightDir, 0.0f)));

    //compute view direction (in eye coordinates, the viewer is situated at the origin
    vec3 viewDir = normalize(- fPosEye.xyz);

    ambient = lightColor * 0.2f; 

    diffuse = max(dot(normalEye, lightDirN), 0.0f) * lightColor;

    vec3 reflectDir = reflect(-lightDirN, normalEye);
    float specCoeff = pow(max(dot(viewDir, reflectDir), 0.0f), 32);
    specular = 0.5f * specCoeff * lightColor; 

    totalAmbient += ambient;
    totalDiffuse += diffuse;
    totalSpecular += specular;
}

void computePointLight(PointLight light)
{
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    // Transform fragment position to eye space
    fPosEye = view * model * vec4(fPosition, 1.0f);

    // Transform light position to eye space
    vec3 lightPosEye = vec3(view * vec4(light.position, 1.0));

    // Calculate normal in eye space
    vec3 normal = normalize(normalMatrix * fNormal);

    // Fragment position in eye space
    vec3 fragPos = vec3(fPosEye);

    // View direction in eye space
    vec3 viewDir = normalize(-fPosEye.xyz);

    // Light direction in eye space
    vec3 lightDir = normalize(lightPosEye - fragPos);

    float diff = max(dot(normal, lightDir), 0.0);

    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0); // shininess fixed at 32 for example

    float distance = length(lightPosEye - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));    

    ambient = light.ambientStrength * light.color;
    diffuse = diff * light.color;
    specular = light.specularStrength * spec * light.color;

    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;

    totalAmbient += ambient;
    totalDiffuse += diffuse;
    totalSpecular += specular;
}

void computeSpotLight(SpotLight light){
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    fPosEye = view * model * vec4(fPosition, 1.0f);

    vec3 lightPosEye = vec3(view * vec4(light.position, 1.0));

    vec3 lightDir = normalize(lightPosEye - fPosEye.xyz);

    vec3 normal = normalize(normalMatrix * fNormal);

    vec3 viewDir = normalize(-fPosEye.xyz);

    float distance = length(lightPosEye - fPosEye.xyz);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));

    float diff = max(dot(normal, lightDir), 0.0);

    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

    float theta = dot(lightDir, normalize(-light.direction));  //cu cat tetha este mai  mare cu atat este mai aproape de centrul conului de lumina
    float epsilon = light.inCutOff - light.outCutOff;//zona de tranzitie
    float intensity = clamp((theta - light.outCutOff) / epsilon, 0.0, 1.0);

    if (theta > light.inCutOff) {//daca ne aflam in zona centrala primim lumina
        ambient = light.ambientStrength * light.color;
        diffuse = diff * light.color;
        specular = light.specularStrength * spec * light.color;
    } else {
        ambient = vec3(0.0);
        diffuse = vec3(0.0);
        specular = vec3(0.0);
    }

    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;

    totalAmbient += ambient * intensity;
    totalDiffuse += diffuse * intensity;
    totalSpecular += specular * intensity;
}
float computeFog() 
{ 
    float fogDensity = 0.005f; 
    if(fogEnabled == false) {
        fogDensity = 0.0f; 
    }

    float fragmentDistance = length(fPosEye); 
    float fogFactor = exp(-pow(fragmentDistance * fogDensity, 2)); 
    return clamp(fogFactor, 0.0f, 1.0f); 

} 

void main() 
{
 if (dirLightEnabled) {
        computeDirLight();
    }
    if (pointLightEnabled) {
        for(int i = 0; i < NR_POINT_LIGHTS; i++){

        computePointLight(pointLight[i]);
        }
    }
    if ( spotLightEnabled){
     for(int i = 0; i < NR_SPOT_LIGHTS; i++){
    computeSpotLight(spotLight[i]);
    }
    }

    // final color
    totalAmbient *= texture(diffuseTexture, fTexCoords).rgb;
    totalDiffuse *= texture(diffuseTexture, fTexCoords).rgb;
    totalSpecular *= texture(specularTexture, fTexCoords).rgb;

    vec3 color = min(totalAmbient + totalDiffuse + totalSpecular, 1.0f);

    float fogFactor = computeFog(); 
    vec4 fogColor = vec4(0.5f, 0.5f, 0.5f, 1.0f); 
    fColor = fogColor * (1.0 - fogFactor) + vec4(color, 1.0) * fogFactor;
}